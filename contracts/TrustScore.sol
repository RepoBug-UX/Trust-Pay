// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract TrustScore {
    struct TrustData {
        uint256 totalPayments;
        uint256 totalVolume;     // in USDT (6 decimals)
        uint256 firstPurchase;   // timestamp
        uint256 defaults;
    }

    mapping(address => TrustData) public trustData;
    mapping(address => bool) public authorized;
    address public owner;

    event ScoreUpdated(address indexed customer, uint256 newScore);
    event DefaultRecorded(address indexed customer, uint256 defaults);
    event AuthorizationChanged(address indexed account, bool status);

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    modifier onlyAuthorized() {
        require(authorized[msg.sender], "Not authorized");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    function setAuthorized(address account, bool status) external onlyOwner {
        authorized[account] = status;
        emit AuthorizationChanged(account, status);
    }

    function recordPayment(address customer, uint256 amount) external onlyAuthorized {
        TrustData storage data = trustData[customer];
        data.totalPayments += 1;
        data.totalVolume += amount;
        if (data.firstPurchase == 0) {
            data.firstPurchase = block.timestamp;
        }
        emit ScoreUpdated(customer, getScore(customer));
    }

    function recordDefault(address customer) external onlyAuthorized {
        trustData[customer].defaults += 1;
        emit DefaultRecorded(customer, trustData[customer].defaults);
    }

    function getScore(address customer) public view returns (uint256) {
        TrustData storage data = trustData[customer];
        if (data.totalPayments == 0) return 0;

        uint256 paymentScore = data.totalPayments * 10;
        uint256 volumeScore = data.totalVolume / (10 * 1e6); // volume / 10 USDT
        uint256 ageDays = (block.timestamp - data.firstPurchase) / 86400;
        uint256 ageScore = ageDays / 2;
        uint256 penalty = data.defaults * 50;

        uint256 positive = paymentScore + volumeScore + ageScore;
        if (penalty >= positive) return 0;
        return positive - penalty;
    }

    function getTier(address customer) external view returns (uint8) {
        uint256 score = getScore(customer);
        if (score >= 300) return 3;      // Established
        if (score >= 150) return 2;      // Trusted
        if (score >= 50) return 1;       // Building
        return 0;                         // New
    }

    function getTrustData(address customer) external view returns (TrustData memory) {
        return trustData[customer];
    }
}
