// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity =0.7.6;

import '@uniswap/v3-core/contracts/libraries/TickMath.sol';

contract TickMathTest {
    function getSqrtRatioAtTick(int24 tick) external pure returns (uint160) {
        return TickMath.getSqrtRatioAtTick(tick);
    }

    function getTickAtSqrtRatio(uint160 sqrtPriceX96) external pure returns (int24) {
        return TickMath.getTickAtSqrtRatio(sqrtPriceX96);
    }

    function MIN_TICK() external pure returns (int24) {
        return TickMath.MIN_TICK;
    }

    function MAX_TICK() external pure returns (int24) {
        return TickMath.MAX_TICK;
    }

    function MIN_SQRT_RATIO() external pure returns (uint160) {
        return TickMath.MIN_SQRT_RATIO;
    }

    function MAX_SQRT_RATIO() external pure returns (uint160) {
        return TickMath.MAX_SQRT_RATIO;
    }
}
