// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import {
    OApp,
    Origin,
    MessagingFee
} from "@layerzerolabs/oapp-evm/contracts/oapp/OApp.sol";
import {
    OAppOptionsType3
} from "@layerzerolabs/oapp-evm/contracts/oapp/libs/OAppOptionsType3.sol";
import {
    OptionsBuilder
} from "@layerzerolabs/oapp-evm/contracts/oapp/libs/OptionsBuilder.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {
    SafeERC20
} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {CoverageTokenBase} from "./CoverageTokenBase.sol";

/// @title BaseInsuranceHub
/// @notice Send-only LayerZero OApp on Base-Sepolia.
///         Handles coverage purchases, expirations, claim lifecycle, and
///         dispatches LOCK/UNLOCK/PAYOUT cross-chain messages to Starknet.
contract BaseInsuranceHub is OApp, OAppOptionsType3 {
    using OptionsBuilder for bytes;
    using SafeERC20 for IERC20;

    // ─── Message type identifiers (must match Starknet decoder) ───────────────
    uint8 private constant MSG_LOCK_COVERAGE = 0x01;
    uint8 private constant MSG_UNLOCK_COVERAGE = 0x02;
    uint8 private constant MSG_PAYOUT_CLAIM = 0x03;

    CoverageTokenBase public coverageToken;
    IERC20 public premiumToken; // USDC on Base
    address public governor; // approve/reject claims
    uint32 public starknetEid; // destination chain EID

    uint256 public nextClaimId;

    enum ClaimStatus {
        None,
        Pending,
        Approved,
        Rejected
    }

    struct Claim {
        uint256 tokenId;
        address claimant;
        ClaimStatus status;
    }

    mapping(uint256 claimId => Claim) public claims;
    mapping(uint256 tokenId => uint256) public activeClaim;

    event CoverageBought(
        uint256 indexed tokenId,
        uint256 protocolId,
        uint256 amount,
        address buyer
    );
    event CoverageExpired(uint256 indexed tokenId, uint256 protocolId);
    event ClaimSubmitted(
        uint256 indexed claimId,
        uint256 tokenId,
        address claimant
    );
    event ClaimApproved(uint256 indexed claimId, uint256 tokenId);
    event ClaimRejected(uint256 indexed claimId);

    modifier onlyGovernor() {
        require(
            msg.sender == governor,
            "BaseInsuranceHub: caller is not governor"
        );
        _;
    }

    constructor(
        address _endpoint,
        address _owner,
        address _coverageToken,
        address _premiumToken,
        address _governor,
        uint32 _starknetEid
    ) OApp(_endpoint, _owner) Ownable(_owner) {
        coverageToken = CoverageTokenBase(_coverageToken);
        premiumToken = IERC20(_premiumToken);
        governor = _governor;
        starknetEid = _starknetEid;
    }

    function _lzReceive(
        Origin calldata,
        bytes32,
        bytes calldata,
        address,
        bytes calldata
    ) internal pure override {
        revert("BaseInsuranceHub: not a receiver");
    }

    function _lzOptions() internal pure returns (bytes memory) {
        return OptionsBuilder.newOptions();
    }

    function _send(bytes memory message) internal {
        bytes memory options = _lzOptions();
        MessagingFee memory fee = _quote(starknetEid, message, options, false);
        require(
            msg.value >= fee.nativeFee,
            "BaseInsuranceHub: insufficient fee"
        );
        _lzSend(
            starknetEid,
            message,
            options,
            MessagingFee(msg.value, 0),
            payable(msg.sender)
        );
    }

    function quoteBuyCoverage(
        uint256 protocolId,
        uint256 amount,
        uint256 tokenId
    ) external view returns (MessagingFee memory) {
        bytes memory message = abi.encodePacked(
            uint8(MSG_LOCK_COVERAGE),
            bytes32(protocolId),
            bytes32(amount),
            bytes32(tokenId)
        );
        return _quote(starknetEid, message, _lzOptions(), false);
    }

    function quoteExpireCoverage(
        uint256 protocolId,
        uint256 amount,
        uint256 tokenId
    ) external view returns (MessagingFee memory) {
        bytes memory message = abi.encodePacked(
            uint8(MSG_UNLOCK_COVERAGE),
            bytes32(protocolId),
            bytes32(amount),
            bytes32(tokenId)
        );
        return _quote(starknetEid, message, _lzOptions(), false);
    }

    function quoteApproveClaim(
        uint256 protocolId,
        uint256 userAddr,
        uint256 amount
    ) external view returns (MessagingFee memory) {
        bytes memory message = abi.encodePacked(
            uint8(MSG_PAYOUT_CLAIM),
            bytes32(protocolId),
            bytes32(userAddr),
            bytes32(amount)
        );
        return _quote(starknetEid, message, _lzOptions(), false);
    }

    /// @notice Purchase a coverage policy.
    ///         Caller must have approved premiumToken spend before calling.
    ///         msg.value must cover the LZ messaging fee (use quoteBuyCoverage).
    /// @param protocolId      ID of the insured protocol on Starknet
    /// @param coverageAmount  USDC amount to lock in vault (6 decimals)
    /// @param duration        Coverage period in seconds
    /// @param premiumAmount   USDC premium caller pays (transferred in)
    function buyCoverage(
        uint256 protocolId,
        uint256 coverageAmount,
        uint64 duration,
        uint256 premiumAmount,
        uint256 /* userStarknetAddr */
    ) external payable {
        // Transfer premium from caller
        premiumToken.safeTransferFrom(msg.sender, address(this), premiumAmount);

        // Mint coverage NFT
        uint256 tokenId = coverageToken.mintCoverage(
            msg.sender,
            protocolId,
            coverageAmount,
            premiumAmount,
            duration
        );

        // Send LOCK_COVERAGE to Starknet
        bytes memory message = abi.encodePacked(
            uint8(MSG_LOCK_COVERAGE),
            bytes32(protocolId),
            bytes32(coverageAmount),
            bytes32(tokenId)
        );
        _send(message);

        emit CoverageBought(tokenId, protocolId, coverageAmount, msg.sender);
    }

    /// @notice Expire a coverage policy after its end time has passed.
    ///         Anyone can call this once the policy is no longer active.
    ///         msg.value must cover the LZ messaging fee (use quoteExpireCoverage).
    function expireCoverage(uint256 tokenId) external payable {
        require(
            !coverageToken.isActive(tokenId),
            "BaseInsuranceHub: coverage still active"
        );

        CoverageTokenBase.CoverageInfo memory info = coverageToken.getCoverage(
            tokenId
        );

        // Send UNLOCK_COVERAGE to Starknet
        bytes memory message = abi.encodePacked(
            uint8(MSG_UNLOCK_COVERAGE),
            bytes32(info.protocolId),
            bytes32(info.coverageAmount),
            bytes32(tokenId)
        );
        _send(message);

        emit CoverageExpired(tokenId, info.protocolId);
    }

    /// @notice Submit a claim for review. No LZ call — purely on-chain record.
    ///         Caller must own the coverage NFT.
    function submitClaim(uint256 tokenId) external {
        require(
            coverageToken.ownerOf(tokenId) == msg.sender,
            "BaseInsuranceHub: not token owner"
        );
        require(
            activeClaim[tokenId] == 0 ||
                claims[activeClaim[tokenId]].status == ClaimStatus.Rejected,
            "BaseInsuranceHub: active claim exists"
        );

        uint256 claimId = nextClaimId++;
        claims[claimId] = Claim({
            tokenId: tokenId,
            claimant: msg.sender,
            status: ClaimStatus.Pending
        });
        activeClaim[tokenId] = claimId;

        emit ClaimSubmitted(claimId, tokenId, msg.sender);
    }

    /// @notice Approve a claim and trigger payout on Starknet.
    ///         msg.value must cover the LZ messaging fee (use quoteApproveClaim).
    /// @param claimId          The claim to approve
    /// @param userStarknetAddr The claimant's Starknet address (felt252 as uint256)
    function approveClaim(
        uint256 claimId,
        uint256 userStarknetAddr
    ) external payable onlyGovernor {
        Claim storage claim = claims[claimId];
        require(
            claim.status == ClaimStatus.Pending,
            "BaseInsuranceHub: claim not pending"
        );

        claim.status = ClaimStatus.Approved;

        CoverageTokenBase.CoverageInfo memory info = coverageToken.getCoverage(
            claim.tokenId
        );

        // Burn NFT
        coverageToken.burnCoverage(claim.tokenId);

        // Send PAYOUT_CLAIM to Starknet
        bytes memory message = abi.encodePacked(
            uint8(MSG_PAYOUT_CLAIM),
            bytes32(info.protocolId),
            bytes32(userStarknetAddr),
            bytes32(info.coverageAmount)
        );
        _send(message);

        emit ClaimApproved(claimId, claim.tokenId);
    }

    /// @notice Reject a pending claim. No LZ call.
    function rejectClaim(uint256 claimId) external onlyGovernor {
        Claim storage claim = claims[claimId];
        require(
            claim.status == ClaimStatus.Pending,
            "BaseInsuranceHub: claim not pending"
        );
        claim.status = ClaimStatus.Rejected;
        emit ClaimRejected(claimId);
    }

    /// @notice Allows owner to update the governor address
    function setGovernor(address newGovernor) external onlyOwner {
        governor = newGovernor;
    }

    /// @notice Allows owner to update the Starknet destination EID
    function setStarknetEid(uint32 newEid) external onlyOwner {
        starknetEid = newEid;
    }

    /// @notice Withdraw accumulated premiums (owner only)
    function withdrawPremiums(address to, uint256 amount) external onlyOwner {
        premiumToken.safeTransfer(to, amount);
    }
}
