// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import {Script, console} from "forge-std/Script.sol";
import {CoverageTokenBase} from "../src/CoverageTokenBase.sol";
import {BaseInsuranceHub} from "../src/BaseInsuranceHub.sol";

contract DeployCoverage is Script {
    // ── Base Sepolia constants ────────────────────────────────────────────────
    address constant LZ_ENDPOINT  = 0x6EDCE65403992e310A62460808c4b910D972f10f;
    address constant USDC_BASE_SEP = 0x036CbD53842c5426634e7929541eC2318f3dCF7e;

    function run() external {
        address owner    = vm.envAddress("OWNER");
        address governor = vm.envOr("GOVERNOR", owner);
        uint256 privKey  = vm.envUint("PRIVATE_KEY");
        uint32  eid      = uint32(vm.envUint("STARKNET_EID")); // set via env, no recompile needed

        vm.startBroadcast(privKey);

        // 1. Deploy CoverageTokenBase
        CoverageTokenBase token = new CoverageTokenBase(owner);
        console.log("CoverageTokenBase:", address(token));

        // 2. Deploy BaseInsuranceHub
        BaseInsuranceHub hub = new BaseInsuranceHub(
            LZ_ENDPOINT,
            owner,
            address(token),
            USDC_BASE_SEP,
            governor,
            eid
        );
        console.log("BaseInsuranceHub: ", address(hub));

        // 3. Wire: grant hub mint/burn rights on the token
        token.setHub(address(hub));
        console.log("Hub set on CoverageTokenBase");

        vm.stopBroadcast();

        console.log("\n--- copy these for Starknet peer setup ---");
        console.log("hub address (bytes32, left-padded):");
        console.logBytes32(bytes32(uint256(uint160(address(hub)))));
    }
}
