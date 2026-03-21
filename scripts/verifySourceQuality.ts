import { evaluateSourceQuality } from "../lib/evaluate/sourceQuality";
import { qualityTestSamples, type QualityTestSample } from "../data/quality-test-samples";

interface TestResult {
  sample: QualityTestSample;
  actual: {
    source_type: string;
    quality_score: number;
    is_high_value: boolean;
    is_noise: boolean;
    quality_reason?: string;
    matched_rules?: string[];
  };
  passed: {
    source_type: boolean;
    is_high_value: boolean;
    is_noise: boolean;
    score_range?: boolean;
  };
}

function runTest(sample: QualityTestSample): TestResult {
  const actual = evaluateSourceQuality({
    url: sample.url,
    title: sample.title,
    cleanText: sample.content,
    extractedItems: []
  });

  const passed = {
    source_type: actual.source_type === sample.expected.source_type,
    is_high_value: actual.is_high_value === sample.expected.is_high_value,
    is_noise: actual.is_noise === sample.expected.is_noise,
    score_range: true
  };

  if (sample.expected.min_score !== undefined && actual.quality_score < sample.expected.min_score) {
    passed.score_range = false;
  }
  if (sample.expected.max_score !== undefined && actual.quality_score > sample.expected.max_score) {
    passed.score_range = false;
  }

  return {
    sample,
    actual: {
      source_type: actual.source_type,
      quality_score: actual.quality_score,
      is_high_value: actual.is_high_value,
      is_noise: actual.is_noise,
      quality_reason: actual.quality_reason,
      matched_rules: actual.matched_rules
    },
    passed
  };
}

function printResult(result: TestResult): void {
  const { sample, actual, passed } = result;
  const allPassed = passed.source_type && passed.is_high_value && passed.is_noise && passed.score_range;
  
  console.log(`\n${"=".repeat(60)}`);
  console.log(`[${allPassed ? "✓ PASS" : "✗ FAIL"}] ${sample.case_name}`);
  console.log(`${"=".repeat(60)}`);
  console.log(`URL: ${sample.url}`);
  console.log(`标题: ${sample.title}`);
  console.log(`内容长度: ${sample.content.length} 字符`);
  console.log(`\n--- 预期 ---`);
  console.log(`  source_type: ${sample.expected.source_type}`);
  console.log(`  is_high_value: ${sample.expected.is_high_value}`);
  console.log(`  is_noise: ${sample.expected.is_noise}`);
  if (sample.expected.min_score !== undefined) {
    console.log(`  最低分: ${sample.expected.min_score}`);
  }
  if (sample.expected.max_score !== undefined) {
    console.log(`  最高分: ${sample.expected.max_score}`);
  }
  
  console.log(`\n--- 实际 ---`);
  console.log(`  source_type: ${actual.source_type} ${passed.source_type ? "✓" : "✗"}`);
  console.log(`  quality_score: ${actual.quality_score} ${passed.score_range ? "✓" : "✗"}`);
  console.log(`  is_high_value: ${actual.is_high_value} ${passed.is_high_value ? "✓" : "✗"}`);
  console.log(`  is_noise: ${actual.is_noise} ${passed.is_noise ? "✓" : "✗"}`);
  
  if (actual.quality_reason) {
    console.log(`\n--- 质量原因 ---`);
    console.log(`  ${actual.quality_reason}`);
  }
  
  if (actual.matched_rules && actual.matched_rules.length > 0) {
    console.log(`\n--- 匹配规则 ---`);
    console.log(`  ${actual.matched_rules.join(", ")}`);
  }

  if (!allPassed) {
    console.log(`\n!!! 失败原因 !!!`);
    if (!passed.source_type) {
      console.log(`  - source_type 不匹配: 期望 ${sample.expected.source_type}, 实际 ${actual.source_type}`);
    }
    if (!passed.is_high_value) {
      console.log(`  - is_high_value 不匹配: 期望 ${sample.expected.is_high_value}, 实际 ${actual.is_high_value}`);
    }
    if (!passed.is_noise) {
      console.log(`  - is_noise 不匹配: 期望 ${sample.expected.is_noise}, 实际 ${actual.is_noise}`);
    }
    if (!passed.score_range) {
      if (sample.expected.min_score !== undefined && actual.quality_score < sample.expected.min_score) {
        console.log(`  - 分数过低: 期望 >= ${sample.expected.min_score}, 实际 ${actual.quality_score}`);
      }
      if (sample.expected.max_score !== undefined && actual.quality_score > sample.expected.max_score) {
        console.log(`  - 分数过高: 期望 <= ${sample.expected.max_score}, 实际 ${actual.quality_score}`);
      }
    }
  }
}

function printSummary(results: TestResult[]): void {
  const total = results.length;
  const passedSourceType = results.filter(r => r.passed.source_type).length;
  const passedHighValue = results.filter(r => r.passed.is_high_value).length;
  const passedNoise = results.filter(r => r.passed.is_noise).length;
  const passedScore = results.filter(r => r.passed.score_range).length;
  const allPassed = results.filter(r => 
    r.passed.source_type && r.passed.is_high_value && r.passed.is_noise && r.passed.score_range
  ).length;

  console.log(`\n${"#".repeat(70)}`);
  console.log(`# 验证结果汇总`);
  console.log(`${"#".repeat(70)}`);
  console.log(`\n总样本数: ${total}`);
  console.log(`\n通过率统计:`);
  console.log(`  - source_type 判定: ${passedSourceType}/${total} (${Math.round(passedSourceType/total*100)}%)`);
  console.log(`  - is_high_value 判定: ${passedHighValue}/${total} (${Math.round(passedHighValue/total*100)}%)`);
  console.log(`  - is_noise 判定: ${passedNoise}/${total} (${Math.round(passedNoise/total*100)}%)`);
  console.log(`  - 分数范围: ${passedScore}/${total} (${Math.round(passedScore/total*100)}%)`);
  console.log(`\n  ★ 总体通过率: ${allPassed}/${total} (${Math.round(allPassed/total*100)}%)`);
  
  const failedResults = results.filter(r => 
    !(r.passed.source_type && r.passed.is_high_value && r.passed.is_noise && r.passed.score_range)
  );
  
  if (failedResults.length > 0) {
    console.log(`\n${"#".repeat(70)}`);
    console.log(`# 失败样本汇总 (${failedResults.length} 个)`);
    console.log(`${"#".repeat(70)}`);
    
    for (const result of failedResults) {
      console.log(`\n[${result.sample.case_name}]`);
      console.log(`  预期: source_type=${result.sample.expected.source_type}, is_high_value=${result.sample.expected.is_high_value}, is_noise=${result.sample.expected.is_noise}`);
      console.log(`  实际: source_type=${result.actual.source_type}, is_high_value=${result.actual.is_high_value}, is_noise=${result.actual.is_noise}, score=${result.actual.quality_score}`);
      
      const reasons: string[] = [];
      if (!result.passed.source_type) reasons.push("type");
      if (!result.passed.is_high_value) reasons.push("high_value");
      if (!result.passed.is_noise) reasons.push("noise");
      if (!result.passed.score_range) reasons.push("score");
      console.log(`  失败项: ${reasons.join(", ")}`);
    }
  } else {
    console.log(`\n✅ 所有测试用例均通过!`);
  }
  
  console.log(`\n${"#".repeat(70)}`);
}

function main(): void {
  console.log(`\n🧪 来源质量验证测试`);
  console.log(`测试样本数: ${qualityTestSamples.length}`);
  
  const results = qualityTestSamples.map(runTest);
  
  for (const result of results) {
    printResult(result);
  }
  
  printSummary(results);
  
  const allPassed = results.filter(r => 
    r.passed.source_type && r.passed.is_high_value && r.passed.is_noise && r.passed.score_range
  ).length;
  
  if (allPassed < results.length) {
    process.exit(1);
  }
}

main();
