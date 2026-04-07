// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract Campaign is ReentrancyGuard, Ownable{

    //string public title;
    //string public description;
    uint256 public goalAmount;
    uint256 public totalRaised;
    uint256 public deadline;
    enum CAMPAIGN_STATUS {ACTIVE, SUCCESS, FAILED, CANCELLED}
    CAMPAIGN_STATUS public status;
    bool public fundsWithdrawn;
    //bool public allowWithdrawIfFails;

    mapping (address => uint256) public contributions;

    event CampaignCreated(address indexed user, uint256 goal, uint256 deadline);
    event Funded(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);
    event Refunded(address indexed user, uint256 amount);
    event CampaignFinished(CAMPAIGN_STATUS status);

    error InvalidDeadline();
    error CampaignNotActive();
    error CampaignStillActive();
    error CampaignExpired();
    error CampaignNotSuccessful();
    error ZeroContribution();
    error FundsAlreadyWithdrawn();
    error TransferFailed();
    error NoContributionToRefund();
    error RefundNotAvailable();
    error InvalidGoalAmount();


    constructor(address initialOwner, uint256 _goalAmount, uint256 _deadline) Ownable(initialOwner) {
        if (_deadline <= block.timestamp) revert InvalidDeadline();
        if (_goalAmount <= 0) revert InvalidGoalAmount(); 
        goalAmount = _goalAmount;
        deadline = _deadline;
        fundsWithdrawn = false;
        status = CAMPAIGN_STATUS.ACTIVE;
        emit CampaignCreated(initialOwner, _goalAmount, _deadline);
    }

    function fund() external payable {
        if(status != CAMPAIGN_STATUS.ACTIVE) revert CampaignNotActive();
        if(deadline <= block.timestamp) revert CampaignExpired();
        if(msg.value == 0) revert ZeroContribution();
        contributions[msg.sender] += msg.value;
        totalRaised += msg.value;
        emit Funded(msg.sender, msg.value);
    }

    function withdraw() external onlyOwner nonReentrant{
        uint256 amount = address(this).balance;
        if(status != CAMPAIGN_STATUS.SUCCESS) revert CampaignNotSuccessful();
        if(fundsWithdrawn == true) revert FundsAlreadyWithdrawn();
        fundsWithdrawn = true;
        (bool success, ) = owner().call{value: amount}("");
        if (!success) revert TransferFailed();
        emit Withdrawn(owner(), amount);
    }

    function refund() external nonReentrant{
        uint256 amount = contributions[msg.sender];
        if(contributions[msg.sender] == 0) revert NoContributionToRefund();
        if(status == CAMPAIGN_STATUS.SUCCESS) revert RefundNotAvailable();
        if(status == CAMPAIGN_STATUS.ACTIVE && block.timestamp < deadline + 7 days) revert RefundNotAvailable();
        if (status == CAMPAIGN_STATUS.ACTIVE && block.timestamp >= deadline + 7 days) {
            status = CAMPAIGN_STATUS.CANCELLED;
            emit CampaignFinished(status);
        }
        contributions[msg.sender] = 0;
        (bool success, ) = msg.sender.call{value: amount}("");
        if (!success) revert TransferFailed();
        emit Refunded(msg.sender, amount);
    }

    function finishCampaign() external onlyOwner {
        if(status != CAMPAIGN_STATUS.ACTIVE) revert CampaignNotActive();
        if(totalRaised < goalAmount && block.timestamp < deadline) revert CampaignStillActive();
        if (totalRaised >= goalAmount) {
            status = CAMPAIGN_STATUS.SUCCESS;
        }
        else {
            status = CAMPAIGN_STATUS.FAILED;
        }
        emit CampaignFinished(status);
    }

    function cancelCampaign() external onlyOwner{
        if(status != CAMPAIGN_STATUS.ACTIVE) revert CampaignNotActive();
        status = CAMPAIGN_STATUS.CANCELLED;
        emit CampaignFinished(status);
    }
}
