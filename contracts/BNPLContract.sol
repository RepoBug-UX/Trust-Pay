// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface ITrustScoreBNPL {
    function getScore(address customer) external view returns (uint256);
    function recordPayment(address customer, uint256 amount) external;
    function recordDefault(address customer) external;
}

interface ILPPool {
    function fundBNPL(address merchant, uint256 amount) external;
    function receiveBNPLRepayment(uint256 amount) external;
}

interface IMerchantRegistry {
    function merchants(address) external view returns (bool isRegistered, string memory name, uint256 totalRevenue, uint256 orderCount);
}

contract BNPLContract {
    struct InstallmentPlan {
        address customer;
        address merchant;
        uint256 totalAmount;
        uint256 downPayment;
        uint256 installmentAmount;
        uint256 numInstallments;
        uint256 installmentsPaid;
        uint256 nextDueDate;
        uint256 intervalSeconds;
        bool isActive;
        bool isDefaulted;
        string productId;
    }

    IERC20 public usdt;
    ITrustScoreBNPL public trustScore;
    ILPPool public lpPool;
    IMerchantRegistry public merchantRegistry;
    uint256 public defaultInterval;

    InstallmentPlan[] public plans;
    mapping(address => uint256[]) public customerPlanIndices;

    uint256 public totalBorrowed;
    uint256 public totalRepaid;
    uint256 public totalDefaulted;

    event PlanCreated(
        uint256 indexed planId,
        address indexed customer,
        address indexed merchant,
        uint256 totalAmount,
        uint256 numInstallments,
        string productId
    );
    event InstallmentCollected(uint256 indexed planId, uint256 installmentNumber, uint256 amount);
    event PlanCompleted(uint256 indexed planId);
    event PlanDefaulted(uint256 indexed planId, address indexed customer);
    event EarlyPayment(uint256 indexed planId, uint256 installmentNumber, uint256 amount);

    constructor(
        address _usdt,
        address _trustScore,
        address _lpPool,
        address _merchantRegistry,
        uint256 _intervalSeconds
    ) {
        usdt = IERC20(_usdt);
        trustScore = ITrustScoreBNPL(_trustScore);
        lpPool = ILPPool(_lpPool);
        merchantRegistry = IMerchantRegistry(_merchantRegistry);
        defaultInterval = _intervalSeconds;
    }

    function createPlan(
        address merchant,
        uint256 totalAmount,
        uint256 numInstallments,
        string calldata productId
    ) external {
        require(numInstallments >= 2 && numInstallments <= 4, "2-4 installments only");
        require(totalAmount > 0, "Amount must be > 0");

        uint256 score = trustScore.getScore(msg.sender);
        require(score >= 50, "Trust score too low for BNPL");

        (bool isRegistered,,,) = merchantRegistry.merchants(merchant);
        require(isRegistered, "Merchant not registered");

        // Down payment = 1/(N+1) of total, remaining N installments
        uint256 downPayment = totalAmount / (numInstallments + 1);
        uint256 remaining = totalAmount - downPayment;
        uint256 installmentAmount = remaining / numInstallments;

        // Customer pays down payment directly to merchant
        require(usdt.transferFrom(msg.sender, merchant, downPayment), "Down payment failed");

        // LP pool funds the remaining to merchant
        lpPool.fundBNPL(merchant, remaining);

        uint256 planId = plans.length;
        plans.push(InstallmentPlan({
            customer: msg.sender,
            merchant: merchant,
            totalAmount: totalAmount,
            downPayment: downPayment,
            installmentAmount: installmentAmount,
            numInstallments: numInstallments,
            installmentsPaid: 0,
            nextDueDate: block.timestamp + defaultInterval,
            intervalSeconds: defaultInterval,
            isActive: true,
            isDefaulted: false,
            productId: productId
        }));

        customerPlanIndices[msg.sender].push(planId);
        totalBorrowed += remaining;

        trustScore.recordPayment(msg.sender, downPayment);

        emit PlanCreated(planId, msg.sender, merchant, totalAmount, numInstallments, productId);
    }

    function collectInstallment(uint256 planId) external {
        InstallmentPlan storage plan = plans[planId];
        require(plan.isActive, "Plan not active");
        require(!plan.isDefaulted, "Plan defaulted");
        require(block.timestamp >= plan.nextDueDate, "Not yet due");
        require(plan.installmentsPaid < plan.numInstallments, "All paid");

        _processInstallment(planId, plan);
    }

    function payEarly(uint256 planId) external {
        InstallmentPlan storage plan = plans[planId];
        require(plan.isActive, "Plan not active");
        require(!plan.isDefaulted, "Plan defaulted");
        require(msg.sender == plan.customer, "Not plan owner");
        require(plan.installmentsPaid < plan.numInstallments, "All paid");

        _processInstallment(planId, plan);
    }

    function _processInstallment(uint256 planId, InstallmentPlan storage plan) internal {
        uint256 amount = plan.installmentAmount;

        // Transfer from customer to this contract, then to LP pool
        require(usdt.transferFrom(plan.customer, address(this), amount), "Payment failed");
        usdt.approve(address(lpPool), amount);
        lpPool.receiveBNPLRepayment(amount);

        plan.installmentsPaid += 1;
        plan.nextDueDate = block.timestamp + plan.intervalSeconds;
        totalRepaid += amount;

        trustScore.recordPayment(plan.customer, amount);

        if (plan.installmentsPaid >= plan.numInstallments) {
            plan.isActive = false;
            emit PlanCompleted(planId);
        }

        emit InstallmentCollected(planId, plan.installmentsPaid, amount);
    }

    function markDefault(uint256 planId) external {
        InstallmentPlan storage plan = plans[planId];
        require(plan.isActive, "Plan not active");
        require(!plan.isDefaulted, "Already defaulted");
        // Grace period: 2x the interval
        require(
            block.timestamp > plan.nextDueDate + (plan.intervalSeconds * 2),
            "Still in grace period"
        );

        plan.isDefaulted = true;
        plan.isActive = false;

        uint256 unpaid = (plan.numInstallments - plan.installmentsPaid) * plan.installmentAmount;
        totalDefaulted += unpaid;

        trustScore.recordDefault(plan.customer);

        emit PlanDefaulted(planId, plan.customer);
    }

    function getPlan(uint256 planId) external view returns (InstallmentPlan memory) {
        return plans[planId];
    }

    function getCustomerPlans(address customer) external view returns (uint256[] memory) {
        return customerPlanIndices[customer];
    }

    function getPlanCount() external view returns (uint256) {
        return plans.length;
    }
}
