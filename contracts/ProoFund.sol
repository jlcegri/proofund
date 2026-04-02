// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract ProoFund is ReentrancyGuard{

    //string public title;
    //string public description;
    address payable public immutable beneficiary;
    uint256 public goalAmount;
    uint256 public totalRaised;
    uint256 public deadline;
    enum CAMPAIGN_STATUS {ACTIVE, SUCCESS, FAILED, CANCELLED}
    CAMPAIGN_STATUS public status;
    bool public fundsWithdrawn;
    //bool public allowWithdrawIfFails;

    mapping (address => uint256) public contributions;

    constructor(uint256 _goalAmount, uint256 _deadline) {
        require (_deadline > block.timestamp);
        goalAmount = _goalAmount;
        deadline = _deadline;
        beneficiary = payable(msg.sender);
        fundsWithdrawn = false;
        status = CAMPAIGN_STATUS.ACTIVE;
    }

    modifier onlyOwner() {
        require(msg.sender == beneficiary);
        _;
    }

    function fund() public payable {
        require(status == CAMPAIGN_STATUS.ACTIVE);
        require(deadline > block.timestamp);
        require(msg.value>0);
        contributions[msg.sender] += msg.value;
        totalRaised += msg.value;
    }

    function withdraw() public onlyOwner nonReentrant{
        uint256 amount = address(this).balance;
        require (status == CAMPAIGN_STATUS.SUCCESS, "Campaign not finished");
        require (fundsWithdrawn == false, "The funds are already withdrawn");
        fundsWithdrawn = true;
        (bool success, ) = beneficiary.call{value: amount}("");
        require(success, "Transfer failed");
    }

    function refund() public nonReentrant{
        uint256 amount = contributions[msg.sender];
        require(contributions[msg.sender] > 0);
        require(status == CAMPAIGN_STATUS.FAILED || status == CAMPAIGN_STATUS.CANCELLED);
        (bool success, ) = msg.sender.call{value: amount}("");
        require(success, "Transfer failed");
        contributions[msg.sender] = 0;
    }

    function finishCampaign() public onlyOwner {
        require(status == CAMPAIGN_STATUS.ACTIVE);
        if (totalRaised >= goalAmount) {
            status = CAMPAIGN_STATUS.SUCCESS;
        }
        else if (totalRaised <= goalAmount && block.timestamp > deadline) {
            status = CAMPAIGN_STATUS.FAILED;
        }
        else {
            status = CAMPAIGN_STATUS.CANCELLED;
        }
    }
}