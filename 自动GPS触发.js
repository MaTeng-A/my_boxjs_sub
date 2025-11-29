// 名称: 自动GPS触发 - 兼容版
// 描述: 专门适配当前环境的自动GPS触发脚本
// 作者: Assistant
// 版本: 4.0

console.log("🚀 自动GPS触发启动...");

// 主函数
function main() {
    const locationData = $persistentStore.read("accurate_gps_location");
    const timestamp = $persistentStore.read("location_timestamp");
    
    if (locationData && timestamp) {
        try {
            const location = JSON.parse(locationData);
            const timeDiff = Math.round((Date.now() - parseInt(timestamp)) / 60000);
            
            console.log(`📍 当前GPS数据: ${location.latitude}, ${location.longitude}`);
            console.log(`⏰ 更新时间: ${timeDiff}分钟前`);
            
            // 如果数据超过5分钟，自动刷新
            if (timeDiff > 5) {
                console.log("🔄 数据超过5分钟，自动刷新...");
                openWeatherDirect();
            } else {
                console.log("✅ 数据新鲜，无需刷新");
                $notification.post(
                    "📍 GPS定位状态",
                    `坐标: ${location.latitude}, ${location.longitude}`,
                    `更新时间: ${timeDiff}分钟前\n数据已是最新`
                );
                $done();
            }
            
        } catch (e) {
            console.log("❌ 数据解析失败:", e);
            openWeatherDirect();
        }
    } else {
        console.log("❌ 无GPS数据，自动获取定位...");
        openWeatherDirect();
    }
}

// 直接打开天气App - 使用已知可用的方法
function openWeatherDirect() {
    console.log("📱 使用window.open打开天气App...");
    
    // 只使用已知可用的方法
    try {
        // 方法1: window.open (已知可用)
        window.open("weather://", "_system");
        console.log("✅ 已通过window.open打开天气App");
        
        $notification.post(
            "🌤️ 天气App已打开",
            "请下拉刷新获取最新位置",
            "等待几秒后GPS数据将自动更新"
        );
        
        // 由于环境限制，我们无法等待和检查更新状态
        // 用户需要手动返回查看结果
        
    } catch (e) {
        console.log("❌ 打开失败:", e);
        $notification.post(
            "⚠️ 自动打开失败",
            "请手动打开天气App",
            "打开系统天气App并下拉刷新以获取GPS"
        );
    }
    
    $done();
}

// 立即执行
main();