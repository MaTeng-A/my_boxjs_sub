// 名称: GPS触发测试版（5分钟触发）
// 描述: 专门用于测试GPS脚本功能，5分钟触发一次
// 版本: 1.0 - 测试专用版

console.log("🧪 GPS触发测试脚本启动");

function main() {
    const gpsTimestamp = $persistentStore.read("location_timestamp");
    const gpsAge = gpsTimestamp ? Math.round((Date.now() - parseInt(gpsTimestamp)) / 60000) : 999;
    
    console.log(`📊 GPS数据年龄: ${gpsAge}分钟`);
    console.log(`⏰ 当前时间: ${new Date().toLocaleString()}`);
    
    if (gpsAge > 5) { // 改为5分钟触发
        console.log("🔄 GPS数据超过5分钟，触发更新流程");
        testGPSUpdate();
    } else {
        console.log("✅ GPS数据新鲜，跳过更新");
        $done();
    }
}

function testGPSUpdate() {
    console.log("🧪 开始GPS更新测试...");
    
    // 记录测试开始时间
    const testStartTime = Date.now();
    $persistentStore.write(testStartTime.toString(), "gps_test_start_time");
    
    // 读取当前GPS数据状态
    const currentGPS = $persistentStore.read("accurate_gps_location");
    const currentTimestamp = $persistentStore.read("location_timestamp");
    
    console.log("📝 测试前状态:");
    console.log(`- 当前GPS数据: ${currentGPS ? "存在" : "不存在"}`);
    console.log(`- 当前时间戳: ${currentTimestamp}`);
    
    if (currentGPS) {
        try {
            const location = JSON.parse(currentGPS);
            console.log(`- 当前坐标: ${location.latitude}, ${location.longitude}`);
            console.log(`- 数据来源: ${location.source}`);
        } catch (e) {
            console.log(`- 数据解析错误: ${e}`);
        }
    }
    
    // 发送通知提醒手动打开天气App
    console.log("📢 发送测试通知...");
    $notification.post(
        "🧪 GPS脚本测试", 
        `数据年龄: ${gpsAge}分钟`,
        "请手动打开天气App测试GPS拦截\n完成后返回查看日志"
    );
    
    console.log("⏳ 等待15秒后检查结果...");
    
    // 15秒后检查是否更新
    setTimeout(() => {
        checkTestResult(testStartTime);
    }, 15000);
}

function checkTestResult(testStartTime) {
    console.log("🔍 检查测试结果...");
    
    const newGPS = $persistentStore.read("accurate_gps_location");
    const newTimestamp = $persistentStore.read("location_timestamp");
    
    console.log("📝 测试后状态:");
    console.log(`- 新GPS数据: ${newGPS ? "存在" : "不存在"}`);
    console.log(`- 新时间戳: ${newTimestamp}`);
    
    if (newGPS && newTimestamp) {
        try {
            const location = JSON.parse(newGPS);
            const updateTime = parseInt(newTimestamp);
            const timeDiff = updateTime - testStartTime;
            
            console.log(`- 新坐标: ${location.latitude}, ${location.longitude}`);
            console.log(`- 数据来源: ${location.source}`);
            console.log(`- 更新时间差: ${timeDiff}ms`);
            
            if (timeDiff > 0) {
                console.log("🎉 测试成功！GPS数据已更新");
                // 成功通知
                $notification.post(
                    "✅ GPS测试成功", 
                    `新坐标: ${location.latitude}, ${location.longitude}`,
                    `数据来源: ${location.source}\n时间差: ${timeDiff}ms`
                );
            } else {
                console.log("⚠️ 测试警告：获取到旧数据");
                $notification.post(
                    "⚠️ GPS测试警告", 
                    "获取到旧数据",
                    "可能天气App未触发新定位\n请确保GPS权限已开启"
                );
            }
        } catch (e) {
            console.log(`❌ 数据解析错误: ${e}`);
            $notification.post(
                "❌ GPS测试失败", 
                "数据解析错误",
                e.toString()
            );
        }
    } else {
        console.log("❌ 测试失败：未获取到新GPS数据");
        console.log("可能原因:");
        console.log("1. 天气App未打开或未触发定位");
        console.log("2. GPS拦截脚本未正常工作");
        console.log("3. 网络连接问题");
        
        $notification.post(
            "❌ GPS测试失败", 
            "未获取到新数据",
            "请检查:\n1. 天气App定位权限\n2. GPS拦截脚本配置\n3. 网络连接"
        );
    }
    
    $done();
}

main();