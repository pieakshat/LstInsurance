// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @title CoverageTokenBase
/// @notice ERC-721 NFT representing an active insurance coverage position.
///         Only the hub contract can mint and burn tokens.
contract CoverageTokenBase is ERC721, Ownable {
    struct CoverageInfo {
        uint256 protocolId;
        uint256 coverageAmount;
        uint256 premiumPaid;
        uint64  startTime;
        uint64  endTime;
    }

    mapping(uint256 tokenId => CoverageInfo) public coverages;
    uint256 private _nextTokenId;
    address public hub;

    modifier onlyHub() {
        require(msg.sender == hub, "CoverageTokenBase: caller is not hub");
        _;
    }

    constructor(address owner) ERC721("StarkInsurance Coverage", "STKC") Ownable(owner) {}

    /// @notice Set the hub address (one-time, owner only)
    function setHub(address hub_) external onlyOwner {
        require(hub == address(0), "CoverageTokenBase: hub already set");
        hub = hub_;
    }

    /// @notice Mint a coverage NFT — called by hub on buyCoverage
    /// @return tokenId The newly minted token ID
    function mintCoverage(
        address to,
        uint256 protocolId,
        uint256 coverageAmount,
        uint256 premiumPaid,
        uint64  duration
    ) external onlyHub returns (uint256 tokenId) {
        tokenId = _nextTokenId++;
        _mint(to, tokenId);
        coverages[tokenId] = CoverageInfo({
            protocolId:     protocolId,
            coverageAmount: coverageAmount,
            premiumPaid:    premiumPaid,
            startTime:      uint64(block.timestamp),
            endTime:        uint64(block.timestamp) + duration
        });
    }

    /// @notice Burn a coverage NFT — called by hub on approveClaim
    function burnCoverage(uint256 tokenId) external onlyHub {
        _burn(tokenId);
        delete coverages[tokenId];
    }

    /// @notice Return coverage metadata for a token
    function getCoverage(uint256 tokenId) external view returns (CoverageInfo memory) {
        return coverages[tokenId];
    }

    /// @notice Returns true while coverage period has not yet expired
    function isActive(uint256 tokenId) external view returns (bool) {
        return block.timestamp <= coverages[tokenId].endTime;
    }
}
