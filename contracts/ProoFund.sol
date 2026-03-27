// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

contract ProoFund {
    //string public title;
    //string public description;
    address payable public beneficiary;
    uint256 public goalAmount;
    uint256 public totalRaised;
    uint256 public deadline;
    enum CAMPAIGN_STATUS {ACTIVE, SUCCESS, FAILED, CANCELLED}
    CAMPAIGN_STATUS public status;
    bool public fundsWithdrawn;

    mapping (address => uint256) public contributions;

    constructor(uint256 _goalAmount, uint256 _deadline) {
        require (deadline > block.timestamp);
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
        require(status == CAMPAIGN_STATUS.ACTIVE && block.timestamp > deadline);
        contributions[msg.sender] += msg.value;
        totalRaised += msg.value;
    }

    function withdraw() public onlyOwner {
        require (
            (status == CAMPAIGN_STATUS.FAILED || status == CAMPAIGN_STATUS.SUCCESS) 
            && fundsWithdrawn == false);
        beneficiary.transfer(address(this).balance);
        fundsWithdrawn = true;
        status = CAMPAIGN_STATUS.SUCCESS;
    }

    function refund() public {
        require(contributions[msg.sender] > 0 && 
                (status == CAMPAIGN_STATUS.FAILED || status == CAMPAIGN_STATUS.CANCELLED));
        uint256 amount = contributions[msg.sender];
        payable(msg.sender).transfer(amount);
        contributions[msg.sender] = 0;
    }

    function finishCampaign() public onlyOwner {
        if (totalRaised >= goalAmount) {
            status = CAMPAIGN_STATUS.SUCCESS;
        }
        else if (totalRaised <= goalAmount) {
            status = CAMPAIGN_STATUS.FAILED;
        }
        else {
            status = CAMPAIGN_STATUS.CANCELLED;
        }
    }
}