//SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;
import './Campaign.sol';

contract CampaignFactory {
    address[] public campaigns;
    mapping(address => address[]) public campaignsByOwner;

    event CampaignCreated(
        address indexed owner,
        address indexed campaign,
        uint256 goalAmount,
        uint256 deadline,
        string metadata
    );

    function createCampaign(uint256 goalAmount, uint256 deadline, string calldata metadata) external returns (address) {
        Campaign campaign = new Campaign(msg.sender, goalAmount, deadline, metadata);

        campaigns.push(address(campaign));
        campaignsByOwner[msg.sender].push(address(campaign));

        emit CampaignCreated(msg.sender, address(campaign), goalAmount, deadline, metadata);

        return address(campaign);
    }

    function getCampaigns() external view returns (address[] memory) {
        return campaigns;
    }

    function getCampaignsByOwner(address owner) external view returns (address[] memory) {
        return campaignsByOwner[owner];
    }
}
