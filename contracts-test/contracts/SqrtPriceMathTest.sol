// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity =0.7.6;

import '@uniswap/v3-core/contracts/libraries/SqrtPriceMath.sol';

contract SqrtPriceMathTest {
    function getAmount0Delta(
        uint160 sqrtRatioAX96,
        uint160 sqrtRatioBX96,
        uint128 liquidity,
        bool roundUp
    ) external pure returns (uint256) {
        return SqrtPriceMath.getAmount0Delta(sqrtRatioAX96, sqrtRatioBX96, liquidity, roundUp);
    }

    function getAmount1Delta(
        uint160 sqrtRatioAX96,
        uint160 sqrtRatioBX96,
        uint128 liquidity,
        bool roundUp
    ) external pure returns (uint256) {
        return SqrtPriceMath.getAmount1Delta(sqrtRatioAX96, sqrtRatioBX96, liquidity, roundUp);
    }

    function getNextSqrtPriceFromInput(
        uint160 sqrtPX96,
        uint128 liquidity,
        uint256 amountIn,
        bool zeroForOne
    ) external pure returns (uint160) {
        return SqrtPriceMath.getNextSqrtPriceFromInput(sqrtPX96, liquidity, amountIn, zeroForOne);
    }

    function getNextSqrtPriceFromOutput(
        uint160 sqrtPX96,
        uint128 liquidity,
        uint256 amountOut,
        bool zeroForOne
    ) external pure returns (uint160) {
        return SqrtPriceMath.getNextSqrtPriceFromOutput(sqrtPX96, liquidity, amountOut, zeroForOne);
    }
}
