// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {CampaignFactory} from "./CampaignFactory.sol";
import {Campaign} from "./Campaign.sol";
import {Test} from "forge-std/Test.sol";

contract CampaignFactoryTest is Test {
    uint256 goalAmount = 1 ether;
    uint256 deadline = block.timestamp + 7 days;
    string metadata = "https://ipfs.io/proofund";

    // createCampaign() tests

    function test_ValidCreateCampaign() public {
        CampaignFactory factory = new CampaignFactory();
        address campaignAddr = factory.createCampaign(goalAmount, deadline, metadata);

        address[] memory all = factory.getCampaigns();
        assertEq(all.length, 1);
        assertEq(all[0], campaignAddr);

        Campaign campaign = Campaign(campaignAddr);
        assertEq(campaign.owner(), address(this));
        assertEq(campaign.goalAmount(), goalAmount);
        assertEq(campaign.deadline(), deadline);
        assertEq(campaign.metadataURI(), metadata);
        assertEq(uint256(campaign.status()), uint256(Campaign.CAMPAIGN_STATUS.ACTIVE));
    }

    function test_CreateCampaignEmitsEvent() public {
        CampaignFactory factory = new CampaignFactory();
        // topic2 (campaign address) is unknown before deploy, so only check owner + data
        vm.expectEmit(true, false, false, true);
        emit CampaignFactory.CampaignCreated(address(this), address(0), goalAmount, deadline, metadata);
        factory.createCampaign(goalAmount, deadline, metadata);
    }

    function test_InvalidDeadlineCreateCampaign() public {
        CampaignFactory factory = new CampaignFactory();
        vm.expectRevert(Campaign.InvalidDeadline.selector);
        factory.createCampaign(goalAmount, block.timestamp, metadata);
    }

    function test_InvalidGoalAmountCreateCampaign() public {
        CampaignFactory factory = new CampaignFactory();
        vm.expectRevert(Campaign.InvalidGoalAmount.selector);
        factory.createCampaign(0, deadline, metadata);
    }

    function test_NoMetadataCreateCampaign() public {
        CampaignFactory factory = new CampaignFactory();
        vm.expectRevert(Campaign.NoMetadata.selector);
        factory.createCampaign(goalAmount, deadline, "");
    }

    function test_MultipleCampaigns() public {
        CampaignFactory factory = new CampaignFactory();
        address addr1 = factory.createCampaign(goalAmount, deadline, metadata);
        address addr2 = factory.createCampaign(2 ether, deadline, metadata);

        address[] memory all = factory.getCampaigns();
        assertEq(all.length, 2);
        assertEq(all[0], addr1);
        assertEq(all[1], addr2);
    }

    // getCampaigns() tests

    function test_GetCampaignsEmpty() public {
        CampaignFactory factory = new CampaignFactory();
        address[] memory all = factory.getCampaigns();
        assertEq(all.length, 0);
    }
}
