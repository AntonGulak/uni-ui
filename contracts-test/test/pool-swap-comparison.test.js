const { expect } = require("chai");
const { ethers } = require("hardhat");

/**
 * REAL Pool vs VirtualPool comparison test
 *
 * This test:
 * 1. Deploys real UniswapV3Factory and creates a real pool
 * 2. Adds multiple liquidity positions
 * 3. Performs swaps on the real pool
 * 4. Compares results with our VirtualPool implementation
 */

// ============ VirtualPool Implementation (same as TypeScript) ============

const Q96 = BigInt("79228162514264337593543950336");
const MIN_TICK = -887272;
const MAX_TICK = 887272;

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

function mostSignificantBit(x) {
  let r = 0;
  if (x >= BigInt("0x100000000000000000000000000000000")) { x >>= 128n; r += 128; }
  if (x >= BigInt("0x10000000000000000")) { x >>= 64n; r += 64; }
  if (x >= BigInt("0x100000000")) { x >>= 32n; r += 32; }
  if (x >= BigInt("0x10000")) { x >>= 16n; r += 16; }
  if (x >= BigInt("0x100")) { x >>= 8n; r += 8; }
  if (x >= BigInt("0x10")) { x >>= 4n; r += 4; }
  if (x >= BigInt("0x4")) { x >>= 2n; r += 2; }
  if (x >= BigInt("0x2")) { r += 1; }
  return r;
}

function getTickAtSqrtRatio(sqrtRatioX96) {
  const sqrtRatioX128 = sqrtRatioX96 << 32n;
  const msb = mostSignificantBit(sqrtRatioX128);

  let r;
  if (msb >= 128) {
    r = sqrtRatioX128 >> BigInt(msb - 127);
  } else {
    r = sqrtRatioX128 << BigInt(127 - msb);
  }

  let log_2 = (BigInt(msb) - 128n) << 64n;

  for (let i = 0; i < 14; i++) {
    r = (r * r) >> 127n;
    const f = r >> 128n;
    log_2 = log_2 | (f << BigInt(63 - i));
    r = r >> f;
  }

  const log_sqrt10001 = log_2 * BigInt("255738958999603826347141");
  const tickLow = Number((log_sqrt10001 - BigInt("3402992956809132418596140100660247210")) >> 128n);
  const tickHigh = Number((log_sqrt10001 + BigInt("291339464771989622907027621153398088495")) >> 128n);

  return tickLow === tickHigh
    ? tickLow
    : getSqrtRatioAtTick(tickHigh) <= sqrtRatioX96
      ? tickHigh
      : tickLow;
}

class VirtualPool {
  constructor(fee, tickSpacing) {
    this.fee = fee;
    this.tickSpacing = tickSpacing;
    this.sqrtPriceX96 = 0n;
    this.tick = 0;
    this.liquidity = 0n;
    this.ticks = new Map();
  }

  initialize(sqrtPriceX96) {
    this.sqrtPriceX96 = BigInt(sqrtPriceX96);
    this.tick = getTickAtSqrtRatio(this.sqrtPriceX96);
  }

  addLiquidity(tickLower, tickUpper, liquidity) {
    const liq = BigInt(liquidity);

    let lowerData = this.ticks.get(tickLower) || { liquidityNet: 0n, liquidityGross: 0n };
    lowerData.liquidityGross += liq;
    lowerData.liquidityNet += liq;
    this.ticks.set(tickLower, lowerData);

    let upperData = this.ticks.get(tickUpper) || { liquidityNet: 0n, liquidityGross: 0n };
    upperData.liquidityGross += liq;
    upperData.liquidityNet -= liq;
    this.ticks.set(tickUpper, upperData);

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
      ? BigInt("4295128740")
      : BigInt("1461446703485210103287273052203988822378723970341");

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
        tick = getTickAtSqrtRatio(sqrtPriceX96);
      }
    }

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
      return { sqrtRatioNextX96: sqrtRatioTargetX96, amountIn: 0n, amountOut: 0n, feeAmount: 0n };
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
          sqrtRatioCurrentX96, liquidity, amountRemainingLessFee, zeroForOne
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
          sqrtRatioCurrentX96, liquidity, -amountRemaining, zeroForOne
        );
      }
    }

    const max = sqrtRatioTargetX96 === sqrtRatioNextX96;

    if (zeroForOne) {
      amountIn = max && exactIn ? amountIn : this.getAmount0Delta(sqrtRatioNextX96, sqrtRatioCurrentX96, liquidity, true);
      amountOut = max && !exactIn ? amountOut : this.getAmount1Delta(sqrtRatioNextX96, sqrtRatioCurrentX96, liquidity, false);
    } else {
      amountIn = max && exactIn ? amountIn : this.getAmount1Delta(sqrtRatioCurrentX96, sqrtRatioNextX96, liquidity, true);
      amountOut = max && !exactIn ? amountOut : this.getAmount0Delta(sqrtRatioCurrentX96, sqrtRatioNextX96, liquidity, false);
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
    if (sqrtRatioAX96 > sqrtRatioBX96) [sqrtRatioAX96, sqrtRatioBX96] = [sqrtRatioBX96, sqrtRatioAX96];
    const numerator1 = liquidity << 96n;
    const numerator2 = sqrtRatioBX96 - sqrtRatioAX96;
    if (roundUp) {
      const temp = (numerator1 * numerator2 + sqrtRatioBX96 - 1n) / sqrtRatioBX96;
      return (temp + sqrtRatioAX96 - 1n) / sqrtRatioAX96;
    }
    return (numerator1 * numerator2 / sqrtRatioBX96) / sqrtRatioAX96;
  }

  getAmount1Delta(sqrtRatioAX96, sqrtRatioBX96, liquidity, roundUp) {
    if (sqrtRatioAX96 > sqrtRatioBX96) [sqrtRatioAX96, sqrtRatioBX96] = [sqrtRatioBX96, sqrtRatioAX96];
    if (roundUp) return (liquidity * (sqrtRatioBX96 - sqrtRatioAX96) + Q96 - 1n) / Q96;
    return (liquidity * (sqrtRatioBX96 - sqrtRatioAX96)) / Q96;
  }

  getNextSqrtPriceFromInput(sqrtPX96, liquidity, amountIn, zeroForOne) {
    if (zeroForOne) {
      const numerator1 = liquidity << 96n;
      const product = amountIn * sqrtPX96;
      const denominator = numerator1 + product;
      return (numerator1 * sqrtPX96 + denominator - 1n) / denominator;
    }
    return sqrtPX96 + (amountIn * Q96) / liquidity;
  }

  getNextSqrtPriceFromOutput(sqrtPX96, liquidity, amountOut, zeroForOne) {
    if (zeroForOne) {
      const quotient = (amountOut * Q96 + liquidity - 1n) / liquidity;
      return sqrtPX96 - quotient;
    }
    const numerator1 = liquidity << 96n;
    const product = amountOut * sqrtPX96;
    const denominator = numerator1 - product;
    return (numerator1 * sqrtPX96 + denominator - 1n) / denominator;
  }
}

// ============ Test Suite ============

describe("Real Pool vs VirtualPool Swap Comparison", function () {
  let factory, pool, token0, token1, swapTest;
  let owner;
  let virtualPool;

  const FEE = 3000;
  const TICK_SPACING = 60;

  before(async function () {
    [owner] = await ethers.getSigners();

    // Deploy test tokens
    const TestERC20 = await ethers.getContractFactory("TestERC20");
    const tokenA = await TestERC20.deploy("Token A", "TKNA", 18);
    const tokenB = await TestERC20.deploy("Token B", "TKNB", 18);
    await tokenA.waitForDeployment();
    await tokenB.waitForDeployment();

    // Sort tokens by address (Uniswap requirement)
    if (BigInt(await tokenA.getAddress()) < BigInt(await tokenB.getAddress())) {
      token0 = tokenA;
      token1 = tokenB;
    } else {
      token0 = tokenB;
      token1 = tokenA;
    }

    console.log("Token0:", await token0.getAddress());
    console.log("Token1:", await token1.getAddress());

    // Deploy UniswapV3Factory from cloned repo
    const UniswapV3Factory = await ethers.getContractFactory("UniswapV3Factory");
    factory = await UniswapV3Factory.deploy();
    await factory.waitForDeployment();
    console.log("Factory deployed:", await factory.getAddress());

    // Create pool
    await factory.createPool(await token0.getAddress(), await token1.getAddress(), FEE);
    const poolAddress = await factory.getPool(await token0.getAddress(), await token1.getAddress(), FEE);
    console.log("Pool created:", poolAddress);

    // Get pool contract
    pool = await ethers.getContractAt("UniswapV3Pool", poolAddress);

    // Deploy swap test helper
    const PoolSwapTest = await ethers.getContractFactory("PoolSwapTest");
    swapTest = await PoolSwapTest.deploy();
    await swapTest.waitForDeployment();

    // Mint tokens
    const mintAmount = ethers.parseEther("1000000");
    await token0.mint(owner.address, mintAmount);
    await token1.mint(owner.address, mintAmount);

    // Approve swap helper
    await token0.approve(await swapTest.getAddress(), ethers.MaxUint256);
    await token1.approve(await swapTest.getAddress(), ethers.MaxUint256);
  });

  describe("Single position swaps", function () {
    const INITIAL_SQRT_PRICE = Q96; // price = 1

    beforeEach(async function () {
      // Reset by redeploying pool
      await factory.createPool(await token0.getAddress(), await token1.getAddress(), 500); // different fee to create new pool
      const newPoolAddress = await factory.getPool(await token0.getAddress(), await token1.getAddress(), 500);

      // Actually, we can't easily reset. Let's just use fresh tests.
    });

    it("should match swap results with single position", async function () {
      // Initialize real pool
      await pool.initialize(INITIAL_SQRT_PRICE);

      // Create virtual pool
      virtualPool = new VirtualPool(FEE, TICK_SPACING);
      virtualPool.initialize(INITIAL_SQRT_PRICE);

      // Get initial state
      const slot0 = await pool.slot0();
      console.log("Real pool initialized at tick:", slot0.tick.toString());
      console.log("Virtual pool initialized at tick:", virtualPool.tick);

      // Add liquidity to real pool
      const tickLower = -600;
      const tickUpper = 600;
      const liquidityAmount = ethers.parseEther("100");

      await swapTest.mint(await pool.getAddress(), tickLower, tickUpper, liquidityAmount);

      // Add same liquidity to virtual pool
      virtualPool.addLiquidity(tickLower, tickUpper, liquidityAmount);

      // Check liquidity matches
      const realLiquidity = await pool.liquidity();
      console.log("Real pool liquidity:", realLiquidity.toString());
      console.log("Virtual pool liquidity:", virtualPool.liquidity.toString());
      expect(virtualPool.liquidity.toString()).to.equal(realLiquidity.toString());

      // Perform swap on real pool
      const swapAmount = ethers.parseEther("1");
      const sqrtPriceLimitX96 = BigInt("4295128740"); // MIN + 1

      const realResult = await swapTest.swap.staticCall(
        await pool.getAddress(),
        true, // zeroForOne
        swapAmount,
        sqrtPriceLimitX96
      );

      // Perform same swap on virtual pool
      const virtualResult = virtualPool.swap(true, BigInt(swapAmount.toString()));

      console.log("\n=== Swap Results ===");
      console.log("Real pool    - amount0:", realResult.amount0.toString(), "amount1:", realResult.amount1.toString());
      console.log("Virtual pool - amount0:", virtualResult.amount0.toString(), "amount1:", virtualResult.amount1.toString());

      // Compare results - amount0 should be positive (input), amount1 should be negative (output)
      expect(realResult.amount0.toString()).to.equal(virtualResult.amount0.toString());

      // amount1 from contract is negative, from virtual it's stored differently
      const realAmount1 = BigInt(realResult.amount1.toString());
      const virtualAmount1 = virtualResult.amount1;

      console.log("Real amount1:", realAmount1.toString());
      console.log("Virtual amount1:", virtualAmount1.toString());

      // They should match (both negative for output)
      expect(realAmount1.toString()).to.equal(virtualAmount1.toString());
    });
  });

  describe("Multi-position swaps", function () {
    it("should match swap results crossing multiple tick ranges", async function () {
      // We need a fresh pool for this test
      // Deploy new tokens and pool
      const TestERC20 = await ethers.getContractFactory("TestERC20");
      const newToken0 = await TestERC20.deploy("Test0", "T0", 18);
      const newToken1 = await TestERC20.deploy("Test1", "T1", 18);

      // Sort
      let t0, t1;
      if (BigInt(await newToken0.getAddress()) < BigInt(await newToken1.getAddress())) {
        t0 = newToken0; t1 = newToken1;
      } else {
        t0 = newToken1; t1 = newToken0;
      }

      // Create new pool
      await factory.createPool(await t0.getAddress(), await t1.getAddress(), FEE);
      const newPoolAddr = await factory.getPool(await t0.getAddress(), await t1.getAddress(), FEE);
      const newPool = await ethers.getContractAt("UniswapV3Pool", newPoolAddr);

      // Mint and approve
      await t0.mint(owner.address, ethers.parseEther("1000000"));
      await t1.mint(owner.address, ethers.parseEther("1000000"));
      await t0.approve(await swapTest.getAddress(), ethers.MaxUint256);
      await t1.approve(await swapTest.getAddress(), ethers.MaxUint256);

      // Initialize
      await newPool.initialize(Q96);

      // Create virtual pool
      const vPool = new VirtualPool(FEE, TICK_SPACING);
      vPool.initialize(Q96);

      // Add multiple positions
      const positions = [
        { tickLower: -1200, tickUpper: 1200, liquidity: ethers.parseEther("50") },
        { tickLower: -600, tickUpper: 600, liquidity: ethers.parseEther("100") },
        { tickLower: -2400, tickUpper: -1200, liquidity: ethers.parseEther("30") },
      ];

      for (const pos of positions) {
        await swapTest.mint(newPoolAddr, pos.tickLower, pos.tickUpper, pos.liquidity);
        vPool.addLiquidity(pos.tickLower, pos.tickUpper, BigInt(pos.liquidity.toString()));
      }

      // Verify liquidity matches
      const realLiq = await newPool.liquidity();
      console.log("\nMulti-position test:");
      console.log("Real liquidity:", realLiq.toString());
      console.log("Virtual liquidity:", vPool.liquidity.toString());
      expect(vPool.liquidity.toString()).to.equal(realLiq.toString());

      // Large swap that crosses ticks
      const swapAmount = ethers.parseEther("20");

      const realResult = await swapTest.swap.staticCall(
        newPoolAddr,
        true,
        swapAmount,
        BigInt("4295128740")
      );

      const virtualResult = vPool.swap(true, BigInt(swapAmount.toString()));

      console.log("\n=== Multi-tick Swap Results ===");
      console.log("Real pool    - amount0:", realResult.amount0.toString(), "amount1:", realResult.amount1.toString());
      console.log("Virtual pool - amount0:", virtualResult.amount0.toString(), "amount1:", virtualResult.amount1.toString());

      // Compare
      expect(realResult.amount0.toString()).to.equal(virtualResult.amount0.toString());
      expect(realResult.amount1.toString()).to.equal(virtualResult.amount1.toString());
    });
  });

  describe("Fuzz-style random swaps", function () {
    it("should match for various swap amounts", async function () {
      // Create fresh pool
      const TestERC20 = await ethers.getContractFactory("TestERC20");
      const fuzzToken0 = await TestERC20.deploy("Fuzz0", "F0", 18);
      const fuzzToken1 = await TestERC20.deploy("Fuzz1", "F1", 18);

      let ft0, ft1;
      if (BigInt(await fuzzToken0.getAddress()) < BigInt(await fuzzToken1.getAddress())) {
        ft0 = fuzzToken0; ft1 = fuzzToken1;
      } else {
        ft0 = fuzzToken1; ft1 = fuzzToken0;
      }

      await factory.createPool(await ft0.getAddress(), await ft1.getAddress(), FEE);
      const fuzzPoolAddr = await factory.getPool(await ft0.getAddress(), await ft1.getAddress(), FEE);
      const fuzzPool = await ethers.getContractAt("UniswapV3Pool", fuzzPoolAddr);

      await ft0.mint(owner.address, ethers.parseEther("10000000"));
      await ft1.mint(owner.address, ethers.parseEther("10000000"));
      await ft0.approve(await swapTest.getAddress(), ethers.MaxUint256);
      await ft1.approve(await swapTest.getAddress(), ethers.MaxUint256);

      await fuzzPool.initialize(Q96);

      const vPool = new VirtualPool(FEE, TICK_SPACING);
      vPool.initialize(Q96);

      // Add wide liquidity
      await swapTest.mint(fuzzPoolAddr, -6000, 6000, ethers.parseEther("1000"));
      vPool.addLiquidity(-6000, 6000, ethers.parseEther("1000"));

      // Test various swap amounts
      const testAmounts = [
        ethers.parseEther("0.001"),
        ethers.parseEther("0.1"),
        ethers.parseEther("1"),
        ethers.parseEther("10"),
        ethers.parseEther("50"),
      ];

      console.log("\n=== Fuzz Test Results ===");

      for (const amount of testAmounts) {
        // Clone virtual pool state for each test
        const testVPool = new VirtualPool(FEE, TICK_SPACING);
        testVPool.sqrtPriceX96 = vPool.sqrtPriceX96;
        testVPool.tick = vPool.tick;
        testVPool.liquidity = vPool.liquidity;
        testVPool.ticks = new Map(vPool.ticks);

        const realResult = await swapTest.swap.staticCall(
          fuzzPoolAddr,
          true,
          amount,
          BigInt("4295128740")
        );

        const virtualResult = testVPool.swap(true, BigInt(amount.toString()));

        const matches = realResult.amount0.toString() === virtualResult.amount0.toString() &&
                       realResult.amount1.toString() === virtualResult.amount1.toString();

        console.log(`Amount: ${ethers.formatEther(amount)} ETH - Match: ${matches ? '✓' : '✗'}`);

        if (!matches) {
          console.log(`  Real:    amount0=${realResult.amount0}, amount1=${realResult.amount1}`);
          console.log(`  Virtual: amount0=${virtualResult.amount0}, amount1=${virtualResult.amount1}`);
        }

        expect(realResult.amount0.toString()).to.equal(virtualResult.amount0.toString());
        expect(realResult.amount1.toString()).to.equal(virtualResult.amount1.toString());
      }
    });
  });
});
