// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity =0.7.6;

import '@uniswap/v3-core/contracts/libraries/SwapMath.sol';

contract SwapMathTest {
    function computeSwapStep(
        uint160 sqrtRatioCurrentX96,
        uint160 sqrtRatioTargetX96,
        uint128 liquidity,
        int256 amountRemaining,
        uint24 feePips
    ) external pure returns (
        uint160 sqrtRatioNextX96,
        uint256 amountIn,
        uint256 amountOut,
        uint256 feeAmount
    ) {
        return SwapMath.computeSwapStep(
            sqrtRatioCurrentX96,
            sqrtRatioTargetX96,
            liquidity,
            amountRemaining,
            feePips
        );
    }
}
