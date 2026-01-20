const { expect } = require("chai");
const { ethers } = require("hardhat");

// Constants from Uniswap
const MIN_TICK = -887272;
const MAX_TICK = 887272;
const Q96 = BigInt("79228162514264337593543950336");

// TickMath implementation
function getSqrtRatioAtTick(tick) {
  const absTick = tick < 0 ? -tick : tick;
  if (absTick > MAX_TICK) throw new Error("TICK_OUT_OF_BOUNDS");

  let ratio = (absTick & 0x1) !== 0
    ? BigInt("0xfffcb933bd6fad37aa2d162d1a594001")
    : BigInt("0x100000000000000000000000000000000");

  if ((absTick & 0x2) !== 0) ratio = (ratio * BigInt("0xfff97272373d413259a46990580e213a")) >> 128n;
  if ((absTick & 0x4) !== 0) ratio = (ratio * BigInt("0xfff2e50f5f656932ef12357cf3c7fdcc")) >> 128n;
  if ((absTick & 0x8) !== 0) ratio = (ratio * BigInt("0xffe5caca7e10e4e61c3624eaa0941cd0")) >> 128n;
  if ((absTick & 0x10) !== 0) ratio = (ratio * BigInt("0xffcb9843d60f6159c9db58835c926644")) >> 128n;
  if ((absTick & 0x20) !== 0) ratio = (ratio * BigInt("0xff973b41fa98c081472e6896dfb254c0")) >> 128n;
  if ((absTick & 0x40) !== 0) ratio = (ratio * BigInt("0xff2ea16466c96a3843ec78b326b52861")) >> 128n;
  if ((absTick & 0x80) !== 0) ratio = (ratio * BigInt("0xfe5dee046a99a2a811c461f1969c3053")) >> 128n;
  if ((absTick & 0x100) !== 0) ratio = (ratio * BigInt("0xfcbe86c7900a88aedcffc83b479aa3a4")) >> 128n;
  if ((absTick & 0x200) !== 0) ratio = (ratio * BigInt("0xf987a7253ac413176f2b074cf7815e54")) >> 128n;
  if ((absTick & 0x400) !== 0) ratio = (ratio * BigInt("0xf3392b0822b70005940c7a398e4b70f3")) >> 128n;
  if ((absTick & 0x800) !== 0) ratio = (ratio * BigInt("0xe7159475a2c29b7443b29c7fa6e889d9")) >> 128n;
  if ((absTick & 0x1000) !== 0) ratio = (ratio * BigInt("0xd097f3bdfd2022b8845ad8f792aa5825")) >> 128n;
  if ((absTick & 0x2000) !== 0) ratio = (ratio * BigInt("0xa9f746462d870fdf8a65dc1f90e061e5")) >> 128n;
  if ((absTick & 0x4000) !== 0) ratio = (ratio * BigInt("0x70d869a156d2a1b890bb3df62baf32f7")) >> 128n;
  if ((absTick & 0x8000) !== 0) ratio = (ratio * BigInt("0x31be135f97d08fd981231505542fcfa6")) >> 128n;
  if ((absTick & 0x10000) !== 0) ratio = (ratio * BigInt("0x9aa508b5b7a84e1c677de54f3e99bc9")) >> 128n;
  if ((absTick & 0x20000) !== 0) ratio = (ratio * BigInt("0x5d6af8dedb81196699c329225ee604")) >> 128n;
  if ((absTick & 0x40000) !== 0) ratio = (ratio * BigInt("0x2216e584f5fa1ea926041bedfe98")) >> 128n;
  if ((absTick & 0x80000) !== 0) ratio = (ratio * BigInt("0x48a170391f7dc42444e8fa2")) >> 128n;

  if (tick > 0) {
    ratio = BigInt("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff") / ratio;
  }

  return (ratio >> 32n) + (ratio % (1n << 32n) === 0n ? 0n : 1n);
}

// Simplified VirtualPool for comparison
class VirtualPool {
  constructor(fee, tickSpacing) {
    this.fee = fee;
    this.tickSpacing = tickSpacing;
    this.sqrtPriceX96 = 0n;
    this.tick = 0;
    this.liquidity = 0n;
    this.ticks = new Map();
    this.initialized = false;
  }

  initialize(sqrtPriceX96) {
    this.sqrtPriceX96 = BigInt(sqrtPriceX96);
    this.tick = this.getTickAtSqrtRatio(this.sqrtPriceX96);
    this.initialized = true;
  }

  getTickAtSqrtRatio(sqrtRatioX96) {
    // Simplified - use binary search or iteration
    for (let t = MIN_TICK; t <= MAX_TICK; t++) {
      const sqrtAtTick = getSqrtRatioAtTick(t);
      if (sqrtAtTick > sqrtRatioX96) {
        return t - 1;
      }
    }
    return MAX_TICK;
  }

  addLiquidity(tickLower, tickUpper, liquidity) {
    const liq = BigInt(liquidity);

    // Update lower tick
    let lowerData = this.ticks.get(tickLower) || { liquidityNet: 0n, liquidityGross: 0n };
    lowerData.liquidityGross += liq;
    lowerData.liquidityNet += liq;
    this.ticks.set(tickLower, lowerData);

    // Update upper tick
    let upperData = this.ticks.get(tickUpper) || { liquidityNet: 0n, liquidityGross: 0n };
    upperData.liquidityGross += liq;
    upperData.liquidityNet -= liq;
    this.ticks.set(tickUpper, upperData);

    // Update active liquidity if in range
    if (this.tick >= tickLower && this.tick < tickUpper) {
      this.liquidity += liq;
    }
  }

  swap(zeroForOne, amountSpecified) {
    const exactInput = amountSpecified >= 0n;
    let amountSpecifiedRemaining = amountSpecified;
    let amountCalculated = 0n;
    let sqrtPriceX96 = this.sqrtPriceX96;
    let tick = this.tick;
    let liquidity = this.liquidity;

    const sqrtPriceLimitX96 = zeroForOne
      ? BigInt("4295128740") // MIN + 1
      : BigInt("1461446703485210103287273052203988822378723970341"); // MAX - 1

    while (amountSpecifiedRemaining !== 0n && sqrtPriceX96 !== sqrtPriceLimitX96) {
      const { tickNext, initialized } = this.findNextInitializedTick(tick, zeroForOne);
      const tickNextClamped = Math.max(MIN_TICK, Math.min(MAX_TICK, tickNext));
      const sqrtPriceNextX96 = getSqrtRatioAtTick(tickNextClamped);

      const sqrtRatioTargetX96 = (zeroForOne
        ? sqrtPriceNextX96 < sqrtPriceLimitX96
        : sqrtPriceNextX96 > sqrtPriceLimitX96)
        ? sqrtPriceLimitX96
        : sqrtPriceNextX96;

      const step = this.computeSwapStep(
        sqrtPriceX96,
        sqrtRatioTargetX96,
        liquidity,
        amountSpecifiedRemaining
      );

      sqrtPriceX96 = step.sqrtRatioNextX96;

      if (exactInput) {
        amountSpecifiedRemaining -= (step.amountIn + step.feeAmount);
        amountCalculated -= step.amountOut;
      } else {
        amountSpecifiedRemaining += step.amountOut;
        amountCalculated += (step.amountIn + step.feeAmount);
      }

      // Cross tick if reached
      if (sqrtPriceX96 === sqrtPriceNextX96) {
        if (initialized) {
          const tickData = this.ticks.get(tickNextClamped);
          if (tickData) {
            let liquidityNet = tickData.liquidityNet;
            if (zeroForOne) liquidityNet = -liquidityNet;
            liquidity += liquidityNet;
          }
        }
        tick = zeroForOne ? tickNextClamped - 1 : tickNextClamped;
      } else {
        tick = this.getTickAtSqrtRatio(sqrtPriceX96);
      }
    }

    // Update state
    this.sqrtPriceX96 = sqrtPriceX96;
    this.tick = tick;
    this.liquidity = liquidity;

    let amount0, amount1;
    if (exactInput) {
      amount0 = zeroForOne ? (amountSpecified - amountSpecifiedRemaining) : amountCalculated;
      amount1 = zeroForOne ? amountCalculated : (amountSpecified - amountSpecifiedRemaining);
    } else {
      amount0 = zeroForOne ? amountCalculated : (amountSpecified - amountSpecifiedRemaining);
      amount1 = zeroForOne ? (amountSpecified - amountSpecifiedRemaining) : amountCalculated;
    }

    return { amount0, amount1, sqrtPriceX96, tick, liquidity };
  }

  findNextInitializedTick(tick, lte) {
    const sortedTicks = Array.from(this.ticks.keys()).sort((a, b) => a - b);

    if (lte) {
      for (let i = sortedTicks.length - 1; i >= 0; i--) {
        if (sortedTicks[i] <= tick) {
          return { tickNext: sortedTicks[i], initialized: true };
        }
      }
      return { tickNext: MIN_TICK, initialized: false };
    } else {
      for (let i = 0; i < sortedTicks.length; i++) {
        if (sortedTicks[i] > tick) {
          return { tickNext: sortedTicks[i], initialized: true };
        }
      }
      return { tickNext: MAX_TICK, initialized: false };
    }
  }

  computeSwapStep(sqrtRatioCurrentX96, sqrtRatioTargetX96, liquidity, amountRemaining) {
    const zeroForOne = sqrtRatioCurrentX96 >= sqrtRatioTargetX96;
    const exactIn = amountRemaining >= 0n;

    let sqrtRatioNextX96;
    let amountIn = 0n;
    let amountOut = 0n;
    let feeAmount = 0n;

    if (liquidity === 0n) {
      return {
        sqrtRatioNextX96: sqrtRatioTargetX96,
        amountIn: 0n,
        amountOut: 0n,
        feeAmount: 0n
      };
    }

    if (exactIn) {
      const amountRemainingLessFee = (amountRemaining * BigInt(1000000 - this.fee)) / 1000000n;

      amountIn = zeroForOne
        ? this.getAmount0Delta(sqrtRatioTargetX96, sqrtRatioCurrentX96, liquidity, true)
        : this.getAmount1Delta(sqrtRatioCurrentX96, sqrtRatioTargetX96, liquidity, true);

      if (amountRemainingLessFee >= amountIn) {
        sqrtRatioNextX96 = sqrtRatioTargetX96;
      } else {
        sqrtRatioNextX96 = this.getNextSqrtPriceFromInput(
          sqrtRatioCurrentX96,
          liquidity,
          amountRemainingLessFee,
          zeroForOne
        );
      }
    } else {
      amountOut = zeroForOne
        ? this.getAmount1Delta(sqrtRatioTargetX96, sqrtRatioCurrentX96, liquidity, false)
        : this.getAmount0Delta(sqrtRatioCurrentX96, sqrtRatioTargetX96, liquidity, false);

      if (-amountRemaining >= amountOut) {
        sqrtRatioNextX96 = sqrtRatioTargetX96;
      } else {
        sqrtRatioNextX96 = this.getNextSqrtPriceFromOutput(
          sqrtRatioCurrentX96,
          liquidity,
          -amountRemaining,
          zeroForOne
        );
      }
    }

    const max = sqrtRatioTargetX96 === sqrtRatioNextX96;

    if (zeroForOne) {
      amountIn = max && exactIn
        ? amountIn
        : this.getAmount0Delta(sqrtRatioNextX96, sqrtRatioCurrentX96, liquidity, true);
      amountOut = max && !exactIn
        ? amountOut
        : this.getAmount1Delta(sqrtRatioNextX96, sqrtRatioCurrentX96, liquidity, false);
    } else {
      amountIn = max && exactIn
        ? amountIn
        : this.getAmount1Delta(sqrtRatioCurrentX96, sqrtRatioNextX96, liquidity, true);
      amountOut = max && !exactIn
        ? amountOut
        : this.getAmount0Delta(sqrtRatioCurrentX96, sqrtRatioNextX96, liquidity, false);
    }

    if (!exactIn && amountOut > -amountRemaining) {
      amountOut = -amountRemaining;
    }

    if (exactIn && sqrtRatioNextX96 !== sqrtRatioTargetX96) {
      feeAmount = amountRemaining - amountIn;
    } else {
      feeAmount = (amountIn * BigInt(this.fee)) / BigInt(1000000 - this.fee) + 1n;
    }

    return { sqrtRatioNextX96, amountIn, amountOut, feeAmount };
  }

  getAmount0Delta(sqrtRatioAX96, sqrtRatioBX96, liquidity, roundUp) {
    if (sqrtRatioAX96 > sqrtRatioBX96) {
      [sqrtRatioAX96, sqrtRatioBX96] = [sqrtRatioBX96, sqrtRatioAX96];
    }

    const numerator1 = liquidity << 96n;
    const numerator2 = sqrtRatioBX96 - sqrtRatioAX96;

    if (roundUp) {
      const temp = (numerator1 * numerator2 + sqrtRatioBX96 - 1n) / sqrtRatioBX96;
      return (temp + sqrtRatioAX96 - 1n) / sqrtRatioAX96;
    } else {
      return (numerator1 * numerator2 / sqrtRatioBX96) / sqrtRatioAX96;
    }
  }

  getAmount1Delta(sqrtRatioAX96, sqrtRatioBX96, liquidity, roundUp) {
    if (sqrtRatioAX96 > sqrtRatioBX96) {
      [sqrtRatioAX96, sqrtRatioBX96] = [sqrtRatioBX96, sqrtRatioAX96];
    }

    if (roundUp) {
      return (liquidity * (sqrtRatioBX96 - sqrtRatioAX96) + Q96 - 1n) / Q96;
    } else {
      return (liquidity * (sqrtRatioBX96 - sqrtRatioAX96)) / Q96;
    }
  }

  getNextSqrtPriceFromInput(sqrtPX96, liquidity, amountIn, zeroForOne) {
    if (zeroForOne) {
      const numerator1 = liquidity << 96n;
      const product = amountIn * sqrtPX96;
      const denominator = numerator1 + product;
      return (numerator1 * sqrtPX96 + denominator - 1n) / denominator;
    } else {
      const quotient = (amountIn * Q96) / liquidity;
      return sqrtPX96 + quotient;
    }
  }

  getNextSqrtPriceFromOutput(sqrtPX96, liquidity, amountOut, zeroForOne) {
    if (zeroForOne) {
      const quotient = (amountOut * Q96 + liquidity - 1n) / liquidity;
      return sqrtPX96 - quotient;
    } else {
      const numerator1 = liquidity << 96n;
      const product = amountOut * sqrtPX96;
      const denominator = numerator1 - product;
      return (numerator1 * sqrtPX96 + denominator - 1n) / denominator;
    }
  }
}

describe("Multi-Tick Swap Comparison", function () {
  let factory, pool, token0, token1, swapHelper;
  let owner;

  const FEE = 3000;
  const TICK_SPACING = 60;

  before(async function () {
    [owner] = await ethers.getSigners();

    // Deploy tokens
    const TestERC20 = await ethers.getContractFactory("TestERC20");
    const tokenA = await TestERC20.deploy("TokenA", "TKNA", 18);
    const tokenB = await TestERC20.deploy("TokenB", "TKNB", 18);

    // Sort tokens
    if (BigInt(await tokenA.getAddress()) < BigInt(await tokenB.getAddress())) {
      token0 = tokenA;
      token1 = tokenB;
    } else {
      token0 = tokenB;
      token1 = tokenA;
    }

    // Deploy factory
    const UniswapV3Factory = await ethers.getContractFactory(
      "@uniswap/v3-core/contracts/UniswapV3Factory.sol:UniswapV3Factory"
    );
    factory = await UniswapV3Factory.deploy();

    // Create pool
    await factory.createPool(await token0.getAddress(), await token1.getAddress(), FEE);
    const poolAddress = await factory.getPool(await token0.getAddress(), await token1.getAddress(), FEE);
    pool = await ethers.getContractAt("@uniswap/v3-core/contracts/UniswapV3Pool.sol:UniswapV3Pool", poolAddress);

    // Deploy swap helper
    const PoolSwapTest = await ethers.getContractFactory("PoolSwapTest");
    swapHelper = await PoolSwapTest.deploy();

    // Mint tokens to owner
    const mintAmount = ethers.parseEther("1000000");
    await token0.mint(owner.address, mintAmount);
    await token1.mint(owner.address, mintAmount);

    // Approve tokens
    await token0.approve(await swapHelper.getAddress(), ethers.MaxUint256);
    await token1.approve(await swapHelper.getAddress(), ethers.MaxUint256);

    console.log("Pool deployed at:", poolAddress);
    console.log("Token0:", await token0.getAddress());
    console.log("Token1:", await token1.getAddress());
  });

  describe("Multi-position swap comparison", function () {
    let virtualPool;

    beforeEach(async function () {
      // Initialize pool at tick 0 (sqrtPriceX96 = 2^96)
      const sqrtPriceX96 = Q96;
      await pool.initialize(sqrtPriceX96);

      // Create virtual pool
      virtualPool = new VirtualPool(FEE, TICK_SPACING);
      virtualPool.initialize(sqrtPriceX96);

      console.log("Pool initialized at sqrtPriceX96:", sqrtPriceX96.toString());

      // Add multiple positions at different ranges
      const positions = [
        { tickLower: -600, tickUpper: 600, liquidity: ethers.parseEther("100") },
        { tickLower: -1200, tickUpper: -600, liquidity: ethers.parseEther("50") },
        { tickLower: 600, tickUpper: 1200, liquidity: ethers.parseEther("50") },
        { tickLower: -1800, tickUpper: 1800, liquidity: ethers.parseEther("200") },
      ];

      for (const pos of positions) {
        // Add to real pool
        await swapHelper.mint(
          await pool.getAddress(),
          pos.tickLower,
          pos.tickUpper,
          pos.liquidity
        );

        // Add to virtual pool
        virtualPool.addLiquidity(pos.tickLower, pos.tickUpper, BigInt(pos.liquidity.toString()));

        console.log(`Added position: [${pos.tickLower}, ${pos.tickUpper}] liquidity: ${pos.liquidity.toString()}`);
      }

      const slot0 = await pool.slot0();
      console.log("Pool state after positions: tick =", slot0.tick.toString(), ", liquidity =", (await pool.liquidity()).toString());
      console.log("Virtual pool state: tick =", virtualPool.tick, ", liquidity =", virtualPool.liquidity.toString());
    });

    it("compares small zeroForOne swap", async function () {
      const amountIn = ethers.parseEther("1");
      const sqrtPriceLimitX96 = BigInt("4295128740"); // MIN + 1

      // Real pool swap
      const realResult = await swapHelper.swap.staticCall(
        await pool.getAddress(),
        true, // zeroForOne
        amountIn,
        sqrtPriceLimitX96
      );

      // Virtual pool swap
      const virtualResult = virtualPool.swap(true, BigInt(amountIn.toString()));

      console.log("Small swap zeroForOne:");
      console.log("  Real    - amount0:", realResult.amount0.toString(), ", amount1:", realResult.amount1.toString());
      console.log("  Virtual - amount0:", virtualResult.amount0.toString(), ", amount1:", virtualResult.amount1.toString());

      // Compare (allow small rounding differences)
      const amount0Diff = Math.abs(Number(realResult.amount0 - virtualResult.amount0));
      const amount1Diff = Math.abs(Number(realResult.amount1 - (-virtualResult.amount1)));

      expect(amount0Diff).to.be.lessThan(1000); // Allow 1000 wei difference
      expect(amount1Diff).to.be.lessThan(1000);
    });

    it("compares large zeroForOne swap crossing multiple ticks", async function () {
      const amountIn = ethers.parseEther("50"); // Large enough to cross multiple tick ranges
      const sqrtPriceLimitX96 = BigInt("4295128740");

      // Real pool swap
      const realResult = await swapHelper.swap.staticCall(
        await pool.getAddress(),
        true,
        amountIn,
        sqrtPriceLimitX96
      );

      // Virtual pool swap
      const virtualResult = virtualPool.swap(true, BigInt(amountIn.toString()));

      console.log("Large swap zeroForOne (crossing ticks):");
      console.log("  Real    - amount0:", realResult.amount0.toString(), ", amount1:", realResult.amount1.toString());
      console.log("  Virtual - amount0:", virtualResult.amount0.toString(), ", amount1:", virtualResult.amount1.toString());

      // Check that both crossed ticks (amount1 should be negative/output)
      expect(Number(realResult.amount1)).to.be.lessThan(0);
      expect(Number(virtualResult.amount1)).to.be.lessThan(0);

      // Compare amounts (allow 0.1% difference for rounding)
      const amount0Ratio = Number(realResult.amount0) / Number(virtualResult.amount0);
      const amount1Ratio = Number(realResult.amount1) / Number(-virtualResult.amount1);

      expect(amount0Ratio).to.be.closeTo(1, 0.001);
      expect(amount1Ratio).to.be.closeTo(1, 0.001);
    });

    it("compares oneForZero swap", async function () {
      const amountIn = ethers.parseEther("10");
      const sqrtPriceLimitX96 = BigInt("1461446703485210103287273052203988822378723970341");

      // Real pool swap
      const realResult = await swapHelper.swap.staticCall(
        await pool.getAddress(),
        false, // oneForZero
        amountIn,
        sqrtPriceLimitX96
      );

      // Virtual pool swap
      const virtualResult = virtualPool.swap(false, BigInt(amountIn.toString()));

      console.log("Swap oneForZero:");
      console.log("  Real    - amount0:", realResult.amount0.toString(), ", amount1:", realResult.amount1.toString());
      console.log("  Virtual - amount0:", virtualResult.amount0.toString(), ", amount1:", virtualResult.amount1.toString());

      // Compare (amount0 should be negative/output for oneForZero)
      expect(Number(realResult.amount0)).to.be.lessThan(0);
      expect(Number(virtualResult.amount0)).to.be.lessThan(0);

      const amount0Ratio = Number(realResult.amount0) / Number(virtualResult.amount0);
      const amount1Ratio = Number(realResult.amount1) / Number(virtualResult.amount1);

      expect(amount0Ratio).to.be.closeTo(1, 0.001);
      expect(amount1Ratio).to.be.closeTo(1, 0.001);
    });
  });
});
