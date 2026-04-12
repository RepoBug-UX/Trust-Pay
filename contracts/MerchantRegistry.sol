// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface ITrustScore {
    function recordPayment(address customer, uint256 amount) external;
}

contract MerchantRegistry {
    struct Merchant {
        bool isRegistered;
        string name;
        uint256 totalRevenue;
        uint256 orderCount;
    }

    struct PaymentRecord {
        address customer;
        address merchant;
        uint256 amount;
        uint256 timestamp;
        string productId;
    }

    IERC20 public usdt;
    ITrustScore public trustScore;

    mapping(address => Merchant) public merchants;
    PaymentRecord[] public payments;
    mapping(address => uint256[]) public customerPaymentIndices;
    mapping(address => uint256[]) public merchantPaymentIndices;

    event MerchantRegistered(address indexed merchant, string name);
    event PaymentMade(
        address indexed customer,
        address indexed merchant,
        uint256 amount,
        string productId,
        uint256 paymentIndex
    );

    constructor(address _usdt, address _trustScore) {
        usdt = IERC20(_usdt);
        trustScore = ITrustScore(_trustScore);
    }

    function registerMerchant(string calldata name) external {
        require(!merchants[msg.sender].isRegistered, "Already registered");
        merchants[msg.sender] = Merchant({
            isRegistered: true,
            name: name,
            totalRevenue: 0,
            orderCount: 0
        });
        emit MerchantRegistered(msg.sender, name);
    }

    function pay(address merchant, uint256 amount, string calldata productId) external {
        require(merchants[merchant].isRegistered, "Merchant not registered");
        require(amount > 0, "Amount must be > 0");

        require(usdt.transferFrom(msg.sender, merchant, amount), "Transfer failed");

        uint256 index = payments.length;
        payments.push(PaymentRecord({
            customer: msg.sender,
            merchant: merchant,
            amount: amount,
            timestamp: block.timestamp,
            productId: productId
        }));

        customerPaymentIndices[msg.sender].push(index);
        merchantPaymentIndices[merchant].push(index);

        merchants[merchant].totalRevenue += amount;
        merchants[merchant].orderCount += 1;

        trustScore.recordPayment(msg.sender, amount);

        emit PaymentMade(msg.sender, merchant, amount, productId, index);
    }

    function getPayment(uint256 index) external view returns (PaymentRecord memory) {
        return payments[index];
    }

    function getCustomerPayments(address customer) external view returns (uint256[] memory) {
        return customerPaymentIndices[customer];
    }

    function getMerchantPayments(address merchant) external view returns (uint256[] memory) {
        return merchantPaymentIndices[merchant];
    }

    function getPaymentCount() external view returns (uint256) {
        return payments.length;
    }
}
