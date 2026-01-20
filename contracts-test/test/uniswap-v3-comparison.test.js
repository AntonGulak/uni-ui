const { expect } = require("chai");
const { ethers } = require("hardhat");

// Import our TypeScript implementations for comparison
// We'll use BigInt directly since we're comparing with contract results

const Q96 = BigInt("79228162514264337593543950336"); // 2^96
const MIN_TICK = -887272;
const MAX_TICK = 887272;
const MIN_SQRT_RATIO = BigInt("4295128739");
const MAX_SQRT_RATIO = BigInt("1461446703485210103287273052203988822378723970342");

// Our TickMath implementation (same as in TypeScript)
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

  // Convert from Q128.128 to Q64.96
  return (ratio >> 32n) + (ratio % (1n << 32n) === 0n ? 0n : 1n);
}

// mostSignificantBit helper
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
  if (sqrtRatioX96 < MIN_SQRT_RATIO || sqrtRatioX96 >= MAX_SQRT_RATIO) {
    throw new Error("SQRT_RATIO_OUT_OF_BOUNDS");
  }

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

// FullMath helpers
function mulDiv(a, b, denominator) {
  const product = a * b;
  return product / denominator;
}

function mulDivRoundingUp(a, b, denominator) {
  const result = mulDiv(a, b, denominator);
  if ((a * b) % denominator > 0n) {
    return result + 1n;
  }
  return result;
}

// SqrtPriceMath implementation
function getAmount0Delta(sqrtRatioAX96, sqrtRatioBX96, liquidity, roundUp) {
  if (sqrtRatioAX96 > sqrtRatioBX96) {
    [sqrtRatioAX96, sqrtRatioBX96] = [sqrtRatioBX96, sqrtRatioAX96];
  }

  const numerator1 = liquidity << 96n;
  const numerator2 = sqrtRatioBX96 - sqrtRatioAX96;

  if (roundUp) {
    return mulDivRoundingUp(
      mulDivRoundingUp(numerator1, numerator2, sqrtRatioBX96),
      1n,
      sqrtRatioAX96
    );
  } else {
    return mulDiv(numerator1, numerator2, sqrtRatioBX96) / sqrtRatioAX96;
  }
}

function getAmount1Delta(sqrtRatioAX96, sqrtRatioBX96, liquidity, roundUp) {
  if (sqrtRatioAX96 > sqrtRatioBX96) {
    [sqrtRatioAX96, sqrtRatioBX96] = [sqrtRatioBX96, sqrtRatioAX96];
  }

  if (roundUp) {
    return mulDivRoundingUp(liquidity, sqrtRatioBX96 - sqrtRatioAX96, Q96);
  } else {
    return mulDiv(liquidity, sqrtRatioBX96 - sqrtRatioAX96, Q96);
  }
}

// SwapMath implementation
function computeSwapStep(sqrtRatioCurrentX96, sqrtRatioTargetX96, liquidity, amountRemaining, feePips) {
  const zeroForOne = sqrtRatioCurrentX96 >= sqrtRatioTargetX96;
  const exactIn = amountRemaining >= 0n;

  let sqrtRatioNextX96;
  let amountIn;
  let amountOut;
  let feeAmount;

  if (exactIn) {
    const amountRemainingLessFee = mulDiv(
      amountRemaining,
      BigInt(1000000 - Number(feePips)),
      BigInt(1000000)
    );

    amountIn = zeroForOne
      ? getAmount0Delta(sqrtRatioTargetX96, sqrtRatioCurrentX96, liquidity, true)
      : getAmount1Delta(sqrtRatioCurrentX96, sqrtRatioTargetX96, liquidity, true);

    if (amountRemainingLessFee >= amountIn) {
      sqrtRatioNextX96 = sqrtRatioTargetX96;
    } else {
      sqrtRatioNextX96 = getNextSqrtPriceFromInput(
        sqrtRatioCurrentX96,
        liquidity,
        amountRemainingLessFee,
        zeroForOne
      );
    }
  } else {
    amountOut = zeroForOne
      ? getAmount1Delta(sqrtRatioTargetX96, sqrtRatioCurrentX96, liquidity, false)
      : getAmount0Delta(sqrtRatioCurrentX96, sqrtRatioTargetX96, liquidity, false);

    if (-amountRemaining >= amountOut) {
      sqrtRatioNextX96 = sqrtRatioTargetX96;
    } else {
      sqrtRatioNextX96 = getNextSqrtPriceFromOutput(
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
      : getAmount0Delta(sqrtRatioNextX96, sqrtRatioCurrentX96, liquidity, true);
    amountOut = max && !exactIn
      ? amountOut
      : getAmount1Delta(sqrtRatioNextX96, sqrtRatioCurrentX96, liquidity, false);
  } else {
    amountIn = max && exactIn
      ? amountIn
      : getAmount1Delta(sqrtRatioCurrentX96, sqrtRatioNextX96, liquidity, true);
    amountOut = max && !exactIn
      ? amountOut
      : getAmount0Delta(sqrtRatioCurrentX96, sqrtRatioNextX96, liquidity, false);
  }

  if (!exactIn && amountOut > -amountRemaining) {
    amountOut = -amountRemaining;
  }

  if (exactIn && sqrtRatioNextX96 !== sqrtRatioTargetX96) {
    feeAmount = amountRemaining - amountIn;
  } else {
    feeAmount = mulDivRoundingUp(amountIn, BigInt(feePips), BigInt(1000000 - Number(feePips)));
  }

  return { sqrtRatioNextX96, amountIn, amountOut, feeAmount };
}

function getNextSqrtPriceFromInput(sqrtPX96, liquidity, amountIn, zeroForOne) {
  if (zeroForOne) {
    return getNextSqrtPriceFromAmount0RoundingUp(sqrtPX96, liquidity, amountIn, true);
  } else {
    return getNextSqrtPriceFromAmount1RoundingDown(sqrtPX96, liquidity, amountIn, true);
  }
}

function getNextSqrtPriceFromOutput(sqrtPX96, liquidity, amountOut, zeroForOne) {
  if (zeroForOne) {
    return getNextSqrtPriceFromAmount1RoundingDown(sqrtPX96, liquidity, amountOut, false);
  } else {
    return getNextSqrtPriceFromAmount0RoundingUp(sqrtPX96, liquidity, amountOut, false);
  }
}

function getNextSqrtPriceFromAmount0RoundingUp(sqrtPX96, liquidity, amount, add) {
  if (amount === 0n) return sqrtPX96;
  const numerator1 = liquidity << 96n;

  if (add) {
    const product = amount * sqrtPX96;
    const denominator = numerator1 + product;
    if (denominator >= numerator1) {
      return mulDivRoundingUp(numerator1, sqrtPX96, denominator);
    }
    return mulDivRoundingUp(numerator1, 1n, numerator1 / sqrtPX96 + amount);
  } else {
    const product = amount * sqrtPX96;
    const denominator = numerator1 - product;
    return mulDivRoundingUp(numerator1, sqrtPX96, denominator);
  }
}

function getNextSqrtPriceFromAmount1RoundingDown(sqrtPX96, liquidity, amount, add) {
  if (add) {
    const quotient = mulDiv(amount, Q96, liquidity);
    return sqrtPX96 + quotient;
  } else {
    const quotient = mulDivRoundingUp(amount, Q96, liquidity);
    return sqrtPX96 - quotient;
  }
}

describe("Uniswap V3 Contract Comparison", function () {
  let tickMathTest;
  let sqrtPriceMathTest;
  let swapMathTest;

  before(async function () {
    // Deploy TickMath test contract
    const TickMathTest = await ethers.getContractFactory("TickMathTest");
    tickMathTest = await TickMathTest.deploy();
    await tickMathTest.waitForDeployment();

    // Deploy SqrtPriceMath test contract
    const SqrtPriceMathTest = await ethers.getContractFactory("SqrtPriceMathTest");
    sqrtPriceMathTest = await SqrtPriceMathTest.deploy();
    await sqrtPriceMathTest.waitForDeployment();

    // Deploy SwapMath test contract
    const SwapMathTest = await ethers.getContractFactory("SwapMathTest");
    swapMathTest = await SwapMathTest.deploy();
    await swapMathTest.waitForDeployment();

    console.log("TickMathTest deployed to:", await tickMathTest.getAddress());
    console.log("SqrtPriceMathTest deployed to:", await sqrtPriceMathTest.getAddress());
    console.log("SwapMathTest deployed to:", await swapMathTest.getAddress());
  });

  describe("TickMath: getSqrtRatioAtTick", function () {
    const testTicks = [
      MIN_TICK,
      MIN_TICK + 1,
      -50000,
      -10000,
      -1000,
      -100,
      -1,
      0,
      1,
      100,
      1000,
      10000,
      50000,
      MAX_TICK - 1,
      MAX_TICK,
    ];

    testTicks.forEach((tick) => {
      it(`tick ${tick}`, async function () {
        const contractResult = await tickMathTest.getSqrtRatioAtTick(tick);
        const ourResult = getSqrtRatioAtTick(tick);

        expect(ourResult.toString()).to.equal(
          contractResult.toString(),
          `Mismatch at tick ${tick}`
        );
      });
    });
  });

  describe("TickMath: getTickAtSqrtRatio", function () {
    const testRatios = [
      MIN_SQRT_RATIO,
      MIN_SQRT_RATIO + 1n,
      Q96 / 2n,
      Q96,
      Q96 * 2n,
      BigInt("1461446703485210103287273052203988822378723970341"), // MAX - 1
    ];

    testRatios.forEach((ratio) => {
      it(`ratio ${ratio.toString().slice(0, 20)}...`, async function () {
        const contractResult = await tickMathTest.getTickAtSqrtRatio(ratio);
        const ourResult = getTickAtSqrtRatio(ratio);

        expect(ourResult).to.equal(
          Number(contractResult),
          `Mismatch at ratio ${ratio}`
        );
      });
    });
  });

  describe("SqrtPriceMath: getAmount0Delta", function () {
    const testCases = [
      {
        name: "small range, small liquidity",
        sqrtRatioA: getSqrtRatioAtTick(0),
        sqrtRatioB: getSqrtRatioAtTick(100),
        liquidity: BigInt("1000000000000000000"), // 1e18
      },
      {
        name: "medium range, medium liquidity",
        sqrtRatioA: getSqrtRatioAtTick(-10000),
        sqrtRatioB: getSqrtRatioAtTick(10000),
        liquidity: BigInt("1000000000000000000000"), // 1e21
      },
      {
        name: "wide range, large liquidity",
        sqrtRatioA: getSqrtRatioAtTick(-50000),
        sqrtRatioB: getSqrtRatioAtTick(50000),
        liquidity: BigInt("1000000000000000000000000"), // 1e24
      },
    ];

    testCases.forEach(({ name, sqrtRatioA, sqrtRatioB, liquidity }) => {
      it(`${name} (roundUp=true)`, async function () {
        const contractResult = await sqrtPriceMathTest.getAmount0Delta(
          sqrtRatioA,
          sqrtRatioB,
          liquidity,
          true
        );
        const ourResult = getAmount0Delta(sqrtRatioA, sqrtRatioB, liquidity, true);

        expect(ourResult.toString()).to.equal(
          contractResult.toString(),
          `Mismatch for ${name}`
        );
      });

      it(`${name} (roundUp=false)`, async function () {
        const contractResult = await sqrtPriceMathTest.getAmount0Delta(
          sqrtRatioA,
          sqrtRatioB,
          liquidity,
          false
        );
        const ourResult = getAmount0Delta(sqrtRatioA, sqrtRatioB, liquidity, false);

        expect(ourResult.toString()).to.equal(
          contractResult.toString(),
          `Mismatch for ${name}`
        );
      });
    });
  });

  describe("SqrtPriceMath: getAmount1Delta", function () {
    const testCases = [
      {
        name: "small range",
        sqrtRatioA: getSqrtRatioAtTick(0),
        sqrtRatioB: getSqrtRatioAtTick(100),
        liquidity: BigInt("1000000000000000000"),
      },
      {
        name: "medium range",
        sqrtRatioA: getSqrtRatioAtTick(-5000),
        sqrtRatioB: getSqrtRatioAtTick(5000),
        liquidity: BigInt("1000000000000000000000"),
      },
    ];

    testCases.forEach(({ name, sqrtRatioA, sqrtRatioB, liquidity }) => {
      it(`${name} (roundUp=true)`, async function () {
        const contractResult = await sqrtPriceMathTest.getAmount1Delta(
          sqrtRatioA,
          sqrtRatioB,
          liquidity,
          true
        );
        const ourResult = getAmount1Delta(sqrtRatioA, sqrtRatioB, liquidity, true);

        expect(ourResult.toString()).to.equal(
          contractResult.toString(),
          `Mismatch for ${name}`
        );
      });

      it(`${name} (roundUp=false)`, async function () {
        const contractResult = await sqrtPriceMathTest.getAmount1Delta(
          sqrtRatioA,
          sqrtRatioB,
          liquidity,
          false
        );
        const ourResult = getAmount1Delta(sqrtRatioA, sqrtRatioB, liquidity, false);

        expect(ourResult.toString()).to.equal(
          contractResult.toString(),
          `Mismatch for ${name}`
        );
      });
    });
  });

  describe("SqrtPriceMath: getNextSqrtPriceFromInput", function () {
    const testCases = [
      {
        name: "zeroForOne small amount",
        sqrtP: getSqrtRatioAtTick(0),
        liquidity: BigInt("1000000000000000000000"),
        amount: BigInt("1000000000000000000"),
        zeroForOne: true,
      },
      {
        name: "oneForZero small amount",
        sqrtP: getSqrtRatioAtTick(0),
        liquidity: BigInt("1000000000000000000000"),
        amount: BigInt("1000000000000000000"),
        zeroForOne: false,
      },
      {
        name: "zeroForOne large amount",
        sqrtP: getSqrtRatioAtTick(10000),
        liquidity: BigInt("100000000000000000000000"),
        amount: BigInt("10000000000000000000"),
        zeroForOne: true,
      },
    ];

    testCases.forEach(({ name, sqrtP, liquidity, amount, zeroForOne }) => {
      it(name, async function () {
        const contractResult = await sqrtPriceMathTest.getNextSqrtPriceFromInput(
          sqrtP,
          liquidity,
          amount,
          zeroForOne
        );
        const ourResult = getNextSqrtPriceFromInput(sqrtP, liquidity, amount, zeroForOne);

        expect(ourResult.toString()).to.equal(
          contractResult.toString(),
          `Mismatch for ${name}`
        );
      });
    });
  });

  describe("SqrtPriceMath: getNextSqrtPriceFromOutput", function () {
    const testCases = [
      {
        name: "zeroForOne small output",
        sqrtP: getSqrtRatioAtTick(0),
        liquidity: BigInt("1000000000000000000000"),
        amount: BigInt("100000000000000000"),
        zeroForOne: true,
      },
      {
        name: "oneForZero small output",
        sqrtP: getSqrtRatioAtTick(0),
        liquidity: BigInt("1000000000000000000000"),
        amount: BigInt("100000000000000000"),
        zeroForOne: false,
      },
    ];

    testCases.forEach(({ name, sqrtP, liquidity, amount, zeroForOne }) => {
      it(name, async function () {
        const contractResult = await sqrtPriceMathTest.getNextSqrtPriceFromOutput(
          sqrtP,
          liquidity,
          amount,
          zeroForOne
        );
        const ourResult = getNextSqrtPriceFromOutput(sqrtP, liquidity, amount, zeroForOne);

        expect(ourResult.toString()).to.equal(
          contractResult.toString(),
          `Mismatch for ${name}`
        );
      });
    });
  });

  describe("SwapMath: computeSwapStep", function () {
    const testCases = [
      {
        name: "exactIn zeroForOne partial fill (3000 fee)",
        sqrtRatioCurrent: getSqrtRatioAtTick(0),
        sqrtRatioTarget: getSqrtRatioAtTick(-1000),
        liquidity: BigInt("1000000000000000000000"),
        amountRemaining: BigInt("100000000000000000"),
        feePips: 3000,
      },
      {
        name: "exactIn oneForZero partial fill (500 fee)",
        sqrtRatioCurrent: getSqrtRatioAtTick(0),
        sqrtRatioTarget: getSqrtRatioAtTick(1000),
        liquidity: BigInt("1000000000000000000000"),
        amountRemaining: BigInt("100000000000000000"),
        feePips: 500,
      },
      {
        name: "exactIn zeroForOne full fill (10000 fee)",
        sqrtRatioCurrent: getSqrtRatioAtTick(0),
        sqrtRatioTarget: getSqrtRatioAtTick(-100),
        liquidity: BigInt("100000000000000000000"),
        amountRemaining: BigInt("10000000000000000000"),
        feePips: 10000,
      },
      {
        name: "exactOut zeroForOne (3000 fee)",
        sqrtRatioCurrent: getSqrtRatioAtTick(0),
        sqrtRatioTarget: getSqrtRatioAtTick(-1000),
        liquidity: BigInt("1000000000000000000000"),
        amountRemaining: BigInt("-50000000000000000"),
        feePips: 3000,
      },
      {
        name: "exactOut oneForZero (3000 fee)",
        sqrtRatioCurrent: getSqrtRatioAtTick(0),
        sqrtRatioTarget: getSqrtRatioAtTick(1000),
        liquidity: BigInt("1000000000000000000000"),
        amountRemaining: BigInt("-50000000000000000"),
        feePips: 3000,
      },
    ];

    testCases.forEach(({ name, sqrtRatioCurrent, sqrtRatioTarget, liquidity, amountRemaining, feePips }) => {
      it(name, async function () {
        const [
          contractSqrtRatioNext,
          contractAmountIn,
          contractAmountOut,
          contractFeeAmount
        ] = await swapMathTest.computeSwapStep(
          sqrtRatioCurrent,
          sqrtRatioTarget,
          liquidity,
          amountRemaining,
          feePips
        );

        const ourResult = computeSwapStep(
          sqrtRatioCurrent,
          sqrtRatioTarget,
          liquidity,
          amountRemaining,
          BigInt(feePips)
        );

        expect(ourResult.sqrtRatioNextX96.toString()).to.equal(
          contractSqrtRatioNext.toString(),
          `sqrtRatioNext mismatch for ${name}`
        );
        expect(ourResult.amountIn.toString()).to.equal(
          contractAmountIn.toString(),
          `amountIn mismatch for ${name}`
        );
        expect(ourResult.amountOut.toString()).to.equal(
          contractAmountOut.toString(),
          `amountOut mismatch for ${name}`
        );
        expect(ourResult.feeAmount.toString()).to.equal(
          contractFeeAmount.toString(),
          `feeAmount mismatch for ${name}`
        );
      });
    });
  });
});
