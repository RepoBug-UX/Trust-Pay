// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract LPPool {
    IERC20 public usdt;
    address public owner;

    uint256 public totalShares;
    uint256 public totalLent;
    mapping(address => uint256) public shares;
    mapping(address => bool) public authorized;

    event Deposited(address indexed lp, uint256 amount, uint256 sharesIssued);
    event Withdrawn(address indexed lp, uint256 amount, uint256 sharesBurned);
    event BNPLFunded(address indexed merchant, uint256 amount);
    event BNPLRepaid(uint256 amount);
    event AuthorizationChanged(address indexed account, bool status);

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    modifier onlyAuthorized() {
        require(authorized[msg.sender], "Not authorized");
        _;
    }

    constructor(address _usdt) {
        usdt = IERC20(_usdt);
        owner = msg.sender;
    }

    function setAuthorized(address account, bool status) external onlyOwner {
        authorized[account] = status;
        emit AuthorizationChanged(account, status);
    }

    function deposit(uint256 amount) external {
        require(amount > 0, "Amount must be > 0");
        require(usdt.transferFrom(msg.sender, address(this), amount), "Transfer failed");

        uint256 newShares;
        if (totalShares == 0) {
            newShares = amount;
        } else {
            uint256 totalValue = usdt.balanceOf(address(this)) - amount + totalLent;
            newShares = (amount * totalShares) / totalValue;
        }

        shares[msg.sender] += newShares;
        totalShares += newShares;

        emit Deposited(msg.sender, amount, newShares);
    }

    function withdraw(uint256 shareAmount) external {
        require(shareAmount > 0, "Shares must be > 0");
        require(shares[msg.sender] >= shareAmount, "Insufficient shares");

        uint256 totalValue = usdt.balanceOf(address(this)) + totalLent;
        uint256 usdtAmount = (shareAmount * totalValue) / totalShares;
        uint256 available = usdt.balanceOf(address(this));
        require(usdtAmount <= available, "Insufficient available liquidity");

        shares[msg.sender] -= shareAmount;
        totalShares -= shareAmount;

        require(usdt.transfer(msg.sender, usdtAmount), "Transfer failed");

        emit Withdrawn(msg.sender, usdtAmount, shareAmount);
    }

    function fundBNPL(address merchant, uint256 amount) external onlyAuthorized {
        require(usdt.balanceOf(address(this)) >= amount, "Insufficient liquidity");
        totalLent += amount;
        require(usdt.transfer(merchant, amount), "Transfer failed");
        emit BNPLFunded(merchant, amount);
    }

    function receiveBNPLRepayment(uint256 amount) external {
        require(usdt.transferFrom(msg.sender, address(this), amount), "Transfer failed");
        if (totalLent >= amount) {
            totalLent -= amount;
        } else {
            totalLent = 0;
        }
        emit BNPLRepaid(amount);
    }

    function availableLiquidity() external view returns (uint256) {
        return usdt.balanceOf(address(this));
    }

    function utilizationRate() external view returns (uint256) {
        uint256 total = usdt.balanceOf(address(this)) + totalLent;
        if (total == 0) return 0;
        return (totalLent * 10000) / total; // basis points
    }

    function getPositionValue(address lp) external view returns (uint256) {
        if (totalShares == 0) return 0;
        uint256 totalValue = usdt.balanceOf(address(this)) + totalLent;
        return (shares[lp] * totalValue) / totalShares;
    }

    function getTotalValue() external view returns (uint256) {
        return usdt.balanceOf(address(this)) + totalLent;
    }
}
