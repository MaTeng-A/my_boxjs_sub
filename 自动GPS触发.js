// 名称: 自动打开天气App
// 描述: 自动打开系统天气App以触发GPS定位拦截
// 作者: Assistant
// 版本: 1.0

console.log("🌤️ 准备打开天气App...");

// 尝试使用URL Scheme打开天气App
function openWeatherApp() {
    // iOS系统天气App的URL Scheme
    const weatherURL = "weather://";
    
    // 尝试打开天气App
    console.log("📱 尝试打开系统天气App...");
    
    // 使用不同的方式尝试打开
    const openMethods = [
        () => $utils.openURL(weatherURL), // Surge/Loon方式
        () => $task.openURL({ url: weatherURL }), // Quantumult X方式
        () => window.open(weatherURL, '_system') // 通用方式
    ];
    
    let opened = false;
    
    for (let method of openMethods) {
        try {
            method();
            console.log("✅ 已尝试打开天气App");
            opened = true;
            break;
        } catch (e) {
            // 继续尝试下一种方法
            console.log(`❌ 方法失败: ${e.message}`);
        }
    }
    
    if (!opened) {
        console.log("⚠️ 无法自动打开天气App，请手动打开系统天气App");
        // 显示提示信息
        $notification.post(
            "📍 需要手动操作",
            "请打开系统天气App",
            "这将触发GPS定位拦截并获取准确坐标"
        );
    }
    
    // 延迟后检查GPS状态
    setTimeout(() => {
        checkGPSStatus();
    }, 3000);
}

// 检查GPS状态
function checkGPSStatus() {
    console.log("🔍 检查GPS定位状态...");
    
    const locationData = $persistentStore.read("accurate_gps_location");
    const timestamp = $persistentStore.read("location_timestamp");
    
    if (locationData && timestamp) {
        try {
            const location = JSON.parse(locationData);
            const timeDiff = Math.round((Date.now() - parseInt(timestamp)) / 60000);
            
            console.log(`✅ GPS定位成功: ${location.latitude}, ${location.longitude}`);
            console.log(`⏰ 更新时间: ${timeDiff}分钟前`);
            
            $notification.post(
                "📍 GPS定位成功",
                `坐标: ${location.latitude}, ${location.longitude}`,
                `更新时间: ${timeDiff}分钟前\n天气数据已准备就绪`
            );
            
        } catch (e) {
            console.log("❌ GPS数据解析失败:", e);
        }
    } else {
        console.log("❌ 尚未获取到GPS数据");
        console.log("💡 提示: 请在天气App中允许位置访问权限");
        
        $notification.post(
            "📍 等待GPS定位",
            "请在天气App中操作",
            "1. 允许位置访问权限\n2. 下拉刷新天气数据\n3. 等待定位完成"
        );
    }
}

// 主执行逻辑
function main() {
    console.log("🚀 开始自动GPS定位流程");
    
    // 先检查是否已有GPS数据
    const existingData = $persistentStore.read("accurate_gps_location");
    if (existingData) {
        console.log("📊 发现已有GPS数据，显示当前状态");
        checkGPSStatus();
    } else {
        console.log("🆕 未发现GPS数据，开始自动流程");
        openWeatherApp();
    }
}

// 执行主函数
main();

// 如果是定时任务，可以设置完成
$done ? $done() : null;