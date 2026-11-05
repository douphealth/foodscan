// src/domain/versus.js
function versus(a, b) {
  const col = (p) => {
    const g = assessGrade(p), q = dataQuality(p);
    return { product: p, grade: g.grade, status: g.status, estimated: g.status === "estimated", quality: q.state, qualityLabel: q.short, family: productFamily(p), allergens: reconcileAllergens(p) };
  };
  const left = col(a), right = col(b);
  const sameUnit = Boolean(a?.basis) && a.basis === b?.basis && ["g", "ml"].includes(a.basis);
  const diffs = sameUnit ? differences(a, b) : [];
  const nova = known(a?.nova) && known(b?.nova) && a.nova !== b.nova ? b.nova < a.nova ? "b" : "a" : "";
  const grade = isGrade(left.grade) && isGrade(right.grade) ? ORDER[left.grade] === ORDER[right.grade] ? "same" : ORDER[right.grade] < ORDER[left.grade] ? "b" : "a" : "unknown";
  const side = (mine) => diffs.filter((d) => mine === "b" === d.good).map((d) => {
    const own = (mine === "a" ? a : b).nutrition[d.key], other = (mine === "a" ? b : a).nutrition[d.key];
    return { key: d.key, mine: own, other, unit: a.basis === "ml" ? "100 ml" : "100 g" };
  });
  return {
    left,
    right,
    sameUnit,
    sameKind: !left.family || !right.family || left.family === right.family,
    grade,
    gradeGap: grade === "a" || grade === "b" ? Math.abs(ORDER[left.grade] - ORDER[right.grade]) : 0,
    // Each side's measured advantages, with both values: A's list holds what A does better, B's what B does better.
    better: { a: side("a"), b: side("b") },
    nova,
    allergens: { inBNotA: allergenChange(a, b), inANotB: allergenChange(b, a) }
  };
}
function versusLine(v, t2) {
  const name = (c) => c.product.name;
  if (v.grade === "same") return t2("{a} and {b} have the same grade ({grade}).", { a: name(v.left), b: name(v.right), grade: v.left.grade });
  if (v.grade === "unknown") return t2("{a} vs {b}: only one of them has a grade to compare.", { a: name(v.left), b: name(v.right) });
  const [hi, lo] = v.grade === "a" ? [v.left, v.right] : [v.right, v.left];
  return t2("{hi} has the higher grade: {hiGrade} vs {loGrade} for {lo}.", { hi: name(hi), hiGrade: hi.grade, lo: name(lo), loGrade: lo.grade });
}

