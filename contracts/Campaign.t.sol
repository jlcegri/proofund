// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Campaign} from "./Campaign.sol";
import {Test} from "forge-std/Test.sol";

contract CampaignTest is Test {
    Campaign campaign;
    uint256 goalAmount = 1 ether;
    uint256 deadline = block.timestamp + 7 days;
    address initialOwner = address(this);
    string metadata = "https://ipfs.io/proofund";

    // constructor() tests

    function test_ValidCampaign() public {
        campaign = new Campaign(initialOwner, goalAmount, deadline, metadata);

        assertEq(campaign.owner(), initialOwner);
        assertEq(campaign.goalAmount(), goalAmount);
        assertEq(campaign.deadline(), deadline);
        assertEq(uint256(campaign.status()), uint256(Campaign.CAMPAIGN_STATUS.ACTIVE));
        assertEq(campaign.fundsWithdrawn(), false);
        assertEq(campaign.totalRaised(), 0);
    }

    function test_InvalidDeadline() public {
        vm.expectRevert(Campaign.InvalidDeadline.selector);
        deadline = block.timestamp;
        campaign = new Campaign(initialOwner, goalAmount, deadline, metadata);
    }

    function test_InvalidGoalAmount() public {
        vm.expectRevert(Campaign.InvalidGoalAmount.selector);
        goalAmount = 0;
        campaign = new Campaign(initialOwner, goalAmount, deadline, metadata);
    }

    function test_InvalidInitialOwner() public {
        vm.expectRevert();
        initialOwner = address(0);
        campaign = new Campaign(initialOwner, goalAmount, deadline, metadata);
    }

    // fund() tests

    function test_ValidFund() public {
        campaign = new Campaign(initialOwner, goalAmount, deadline, metadata);
        vm.expectEmit();
        emit Campaign.Funded(initialOwner, 1 ether);
        campaign.fund{value: 1 ether}();
    }

    function test_CampaignNotActiveFund() public {
        campaign = new Campaign(initialOwner, goalAmount, deadline, metadata);
        campaign.cancelCampaign();
        vm.expectRevert(Campaign.CampaignNotActive.selector);
        campaign.fund{value: 1 ether}();
    }

    function test_CampaignExpired() public {
        campaign = new Campaign(initialOwner, goalAmount, deadline, metadata);
        vm.warp(block.timestamp + 7 days);
        vm.expectRevert(Campaign.CampaignExpired.selector);
        campaign.fund{value: 1 ether}();
    }

    function test_ZeroContribution() public {
        campaign = new Campaign(initialOwner, goalAmount, deadline, metadata);
        vm.expectRevert(Campaign.ZeroContribution.selector);
        campaign.fund{value: 0 ether}();
    }

    // withdraw() tests

    function test_ValidWithdraw() public {
        address owner = makeAddr("owner");
        campaign = new Campaign(owner, goalAmount, deadline, metadata);

        campaign.fund{value: 1 ether}();

        vm.prank(owner);
        campaign.finishCampaign();

        vm.prank(owner);
        vm.expectEmit();
        emit Campaign.Withdrawn(owner, 1 ether);
        campaign.withdraw();
    }

    function test_OnlyOwnerWithdraw() public {
        address owner = makeAddr("owner");
        address hacker = makeAddr("hacker");
        campaign = new Campaign(owner, goalAmount, deadline, metadata);

        campaign.fund{value: 1 ether}();

        vm.prank(owner);
        campaign.finishCampaign();

        vm.prank(hacker);
        vm.expectRevert();
        campaign.withdraw();
    }

    function test_CampaignNotSuccessful() public {
        address owner = makeAddr("owner");
        campaign = new Campaign(owner, goalAmount, deadline, metadata);

        vm.prank(owner);
        vm.expectRevert(Campaign.CampaignNotSuccessful.selector);
        campaign.withdraw();

        campaign.fund{value: 0.5 ether}();

        vm.warp(block.timestamp + 7 days);
        vm.prank(owner);
        campaign.finishCampaign();

        vm.prank(owner);
        vm.expectRevert(Campaign.CampaignNotSuccessful.selector);
        campaign.withdraw();
    }

    function test_WithdrawTransferFailed() public {
        campaign = new Campaign(initialOwner, goalAmount, deadline, metadata);

        campaign.fund{value: 1 ether}();

        campaign.finishCampaign();

        vm.expectRevert(Campaign.TransferFailed.selector);
        campaign.withdraw();
    }

    function test_FundsAlreadyWithdrawn() public {
        address owner = makeAddr("owner");
        campaign = new Campaign(owner, goalAmount, deadline, metadata);

        campaign.fund{value: 1 ether}();

        vm.prank(owner);
        campaign.finishCampaign();

        vm.prank(owner);
        campaign.withdraw();

        vm.prank(owner);
        vm.expectRevert(Campaign.FundsAlreadyWithdrawn.selector);
        campaign.withdraw();
        
    }

    // refund() tests

    function test_ValidRefund() public {
        address owner = makeAddr("owner");
        address funder = makeAddr("funder");
        vm.deal(funder, 1 ether);

        campaign = new Campaign(owner, goalAmount, deadline, metadata);

        vm.prank(funder);
        campaign.fund{value: 1 ether}();

        vm.prank(owner);
        campaign.cancelCampaign();

        vm.prank(funder);
        vm.expectEmit();
        emit Campaign.Refunded(funder, 1 ether);
        campaign.refund();
    }

    function test_NoContributionToRefund() public {
        address owner = makeAddr("owner");
        address funder = makeAddr("funder");
        vm.deal(funder, 1 ether);

        campaign = new Campaign(owner, goalAmount, deadline, metadata);

        vm.prank(funder);
        campaign.fund{value: 1 ether}();

        vm.prank(owner);
        campaign.cancelCampaign();

        vm.prank(funder);
        vm.expectEmit();
        emit Campaign.Refunded(funder, 1 ether);
        campaign.refund();
        vm.expectRevert(Campaign.NoContributionToRefund.selector);
        campaign.refund();
    }

    function test_RefundNotAvailable1() public {
        address owner = makeAddr("owner");
        address funder = makeAddr("funder");
        vm.deal(funder, 1 ether);

        campaign = new Campaign(owner, goalAmount, deadline, metadata);

        vm.prank(funder);
        campaign.fund{value: 1 ether}();

        vm.prank(owner);
        campaign.finishCampaign();

        vm.prank(funder);
        vm.expectRevert(Campaign.RefundNotAvailable.selector);
        campaign.refund();
    }

    function test_RefundNotAvailable2() public {
        address owner = makeAddr("owner");
        address funder = makeAddr("funder");
        vm.deal(funder, 1 ether);

        campaign = new Campaign(owner, goalAmount, deadline, metadata);

        vm.prank(funder);
        campaign.fund{value: 1 ether}();

        vm.prank(funder);
        vm.expectRevert(Campaign.RefundNotAvailable.selector);
        campaign.refund();
    }

    function test_RefundCancelCampaign() public {
        address owner = makeAddr("owner");
        address funder = makeAddr("funder");
        vm.deal(funder, 1 ether);

        campaign = new Campaign(owner, goalAmount, deadline, metadata);

        vm.prank(funder);
        campaign.fund{value: 1 ether}();

        vm.warp(block.timestamp + 14 days);

        vm.prank(funder);
        vm.expectEmit();
        emit Campaign.CampaignFinished(Campaign.CAMPAIGN_STATUS.CANCELLED);
        vm.expectEmit();
        emit Campaign.Refunded(funder, 1 ether);
        campaign.refund();
    }

    function test_RefundTransferFailed() public {
        campaign = new Campaign(initialOwner, goalAmount, deadline, metadata);

        campaign.fund{value: 1 ether}();

        campaign.cancelCampaign();

        vm.expectRevert(Campaign.TransferFailed.selector);
        campaign.refund();
    }

    // finishCampaign() tests

    function test_ValidFinishCampaign() public {
        campaign = new Campaign(initialOwner, goalAmount, deadline, metadata);

        campaign.fund{value: 1 ether}();

        vm.expectEmit();
        emit Campaign.CampaignFinished(Campaign.CAMPAIGN_STATUS.SUCCESS);
        campaign.finishCampaign();
    }

    function test_OnlyOwnerFinishCampaign() public {
        address hacker = makeAddr("hacker");
        address owner = makeAddr("owner");

        campaign = new Campaign(owner, goalAmount, deadline, metadata);

        vm.expectRevert();
        vm.prank(hacker);
        campaign.finishCampaign();
    }

    function test_CampaignNotActiveFinishCampaign() public {
        campaign = new Campaign(initialOwner, goalAmount, deadline, metadata);

        campaign.fund{value: 1 ether}();

        campaign.finishCampaign();

        vm.expectRevert(Campaign.CampaignNotActive.selector);
        campaign.finishCampaign();
    }

    function test_CampaignStillActive() public {
        campaign = new Campaign(initialOwner, goalAmount, deadline, metadata);

        vm.expectRevert(Campaign.CampaignStillActive.selector);
        campaign.finishCampaign();
    }

    // cancelCampaign() tests

    function test_ValidCancelCampaign() public {
        campaign = new Campaign(initialOwner, goalAmount, deadline, metadata);

        vm.expectEmit();
        emit Campaign.CampaignFinished(Campaign.CAMPAIGN_STATUS.CANCELLED);
        campaign.cancelCampaign();
    }

    function test_OnlyOwnerCancelCampaign() public {
        address hacker = makeAddr("hacker");
        address owner = makeAddr("owner");
        campaign = new Campaign(owner, goalAmount, deadline, metadata);

        vm.prank(hacker);
        vm.expectRevert();
        campaign.cancelCampaign();
    }

    function test_CampaignNotActiveCancelCampaign() public {
        campaign = new Campaign(initialOwner, goalAmount, deadline, metadata);

        campaign.cancelCampaign();

        vm.expectRevert(Campaign.CampaignNotActive.selector);
        campaign.cancelCampaign();
    }

    function test_NoMetadata() public {
        vm.expectRevert(Campaign.NoMetadata.selector);
        campaign = new Campaign(initialOwner, goalAmount, deadline, "");
    }





}
