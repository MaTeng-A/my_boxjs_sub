// MITM 验证脚本
if (typeof $request !== 'undefined') {
  console.log(`✅ MITM工作正常: ${$request.url}`);
  $done();
} else {
  console.log('ℹ️ 普通执行模式');
  $done();
}