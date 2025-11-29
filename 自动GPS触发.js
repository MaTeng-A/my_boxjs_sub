// 名称: 自动GPS触发优化版
// 描述: 自动打开天气App并显示GPS状态，5分钟后建议刷新
// 作者: Assistant
// 版本: 2.1

console.log("🌤️ 自动GPS触发启动...");

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
            
            // 如果数据超过5分钟，建议刷新
            if (timeDiff > 5) {
                console.log("🔄 数据超过5分钟，建议刷新");
                showStatusAndOpenWeather(location, timeDiff, true);
            } else {
                console.log("✅ 数据新鲜，显示状态");
                showStatusAndOpenWeather(location, timeDiff, false);
            }
            
        } catch (e) {
            console.log("❌ 数据解析失败:", e);
            openWeatherApp();
        }
    } else {
        console.log("❌ 无GPS数据，打开天气App获取定位");
        openWeatherApp();
    }
}

// 显示状态并打开天气App
function showStatusAndOpenWeather(location, timeDiff, needRefresh) {
    const refreshText = needRefresh ? "（建议刷新）" : "";
    
    // 先显示当前状态
    $notification.post(
        "📍 GPS定位状态" + refreshText,
        `坐标: ${location.latitude}, ${location.longitude}`,
        `更新时间: ${timeDiff}分钟前\n点击确定后自动打开天气App${needRefresh ? "刷新数据" : ""}`
    );
    
    // 延迟2秒后打开天气App
    setTimeout(() => {
        openWeatherApp();
    }, 2000);
}

// 打开天气App
function openWeatherApp() {
    console.log("📱 正在打开系统天气App...");
    
    const weatherURLs = [
        "weather://",
        "appleweather://",
        "com.apple.weather://"
    ];
    
    let opened = false;
    
    for (let url of weatherURLs) {
        try {
            if (typeof $utils !== "undefined") {
                $utils.openURL(url);
                opened = true;
                break;
            } else if (typeof $task !== "undefined") {
                $task.openURL({ url: url });
                opened = true;
                break;
            }
        } catch (e) {
            continue;
        }
    }
    
    if (opened) {
        console.log("✅ 天气App已打开");
        $notification.post(
            "🌤️ 天气App已打开",
            "请等待定位完成",
            "下拉刷新天气数据以确保获取最新位置"
        );
    } else {
        console.log("❌ 无法自动打开天气App");
        $notification.post(
            "⚠️ 需要手动操作",
            "请手动打开系统天气App",
            "打开天气App后下拉刷新以触发GPS定位"
        );
    }
}

// 立即执行
main();

// 完成
if (typeof $done !== "undefined") {
    $done();
}