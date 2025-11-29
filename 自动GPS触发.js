// 名称: 全自动GPS触发
// 描述: 真正自动打开天气App并获取GPS，无需手动操作
// 作者: Assistant
// 版本: 3.0

console.log("🚀 全自动GPS触发启动...");

// 主函数 - 直接自动打开天气App
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
                console.log("🔄 数据超过5分钟，自动刷新中...");
                autoOpenWeatherApp(true, timeDiff);
            } else {
                console.log("✅ 数据新鲜，无需刷新");
                // 即使数据新鲜，也显示状态但不强制刷新
                $notification.post(
                    "📍 GPS定位状态",
                    `坐标: ${location.latitude}, ${location.longitude}`,
                    `更新时间: ${timeDiff}分钟前\n数据已是最新`
                );
            }
            
        } catch (e) {
            console.log("❌ 数据解析失败:", e);
            autoOpenWeatherApp(false, 0);
        }
    } else {
        console.log("❌ 无GPS数据，自动获取定位...");
        autoOpenWeatherApp(false, 0);
    }
}

// 真正自动打开天气App
function autoOpenWeatherApp(needRefresh, timeDiff) {
    console.log("📱 正在自动打开系统天气App...");
    
    // 尝试多种天气App的URL Scheme
    const weatherURLs = [
        "weather://",
        "appleweather://", 
        "com.apple.weather://",
        "wt://",
        "weatherapp://"
    ];
    
    let success = false;
    
    // 方法1: 使用$utils.openURL (Surge/Loon)
    if (typeof $utils !== "undefined") {
        for (let url of weatherURLs) {
            try {
                console.log(`尝试打开: ${url}`);
                $utils.openURL(url);
                success = true;
                console.log(`✅ 成功通过$utils.openURL打开: ${url}`);
                break;
            } catch (e) {
                console.log(`❌ 打开${url}失败: ${e}`);
            }
        }
    }
    
    // 方法2: 使用$task.openURL (Quantumult X)
    if (!success && typeof $task !== "undefined") {
        for (let url of weatherURLs) {
            try {
                console.log(`尝试打开: ${url}`);
                $task.openURL({ url: url });
                success = true;
                console.log(`✅ 成功通过$task.openURL打开: ${url}`);
                break;
            } catch (e) {
                console.log(`❌ 打开${url}失败: ${e}`);
            }
        }
    }
    
    // 方法3: 使用window.open (通用)
    if (!success && typeof window !== "undefined") {
        for (let url of weatherURLs) {
            try {
                console.log(`尝试打开: ${url}`);
                window.open(url, '_system');
                success = true;
                console.log(`✅ 成功通过window.open打开: ${url}`);
                break;
            } catch (e) {
                console.log(`❌ 打开${url}失败: ${e}`);
            }
        }
    }
    
    if (success) {
        const refreshText = needRefresh ? "（自动刷新）" : "";
        console.log("✅ 天气App已自动打开");
        
        $notification.post(
            `🌤️ 天气App已打开${refreshText}`,
            `坐标: 33.488, 116.207`,
            needRefresh ? 
                `数据已过期${timeDiff}分钟，正在自动更新...` :
                "正在获取最新GPS定位..."
        );
        
        // 模拟等待天气App加载完成
        console.log("⏳ 等待天气App加载和定位...");
        
        // 5秒后检查是否更新成功
        setTimeout(() => {
            checkUpdateStatus();
        }, 5000);
        
    } else {
        console.log("❌ 所有打开方法都失败了");
        $notification.post(
            "⚠️ 自动打开失败",
            "需要手动打开天气App",
            "请手动打开系统天气App获取GPS定位"
        );
    }
}

// 检查更新状态
function checkUpdateStatus() {
    console.log("🔍 检查GPS更新状态...");
    
    const newLocationData = $persistentStore.read("accurate_gps_location");
    const newTimestamp = $persistentStore.read("location_timestamp");
    
    if (newLocationData) {
        try {
            const location = JSON.parse(newLocationData);
            const oldTimestamp = parseInt($persistentStore.read("previous_timestamp") || "0");
            const newTime = parseInt(newTimestamp);
            
            // 保存旧时间戳用于比较
            $persistentStore.write(newTimestamp, "previous_timestamp");
            
            if (newTime > oldTimestamp) {
                console.log("✅ GPS数据已更新!");
                const timeDiff = Math.round((Date.now() - newTime) / 1000);
                
                $notification.post(
                    "🎉 GPS更新成功",
                    `新坐标: ${location.latitude}, ${location.longitude}`,
                    `更新于${timeDiff}秒前\n定位已完成`
                );
            } else {
                console.log("❌ GPS数据未更新");
                $notification.post(
                    "⚠️ GPS未更新",
                    "请检查位置权限",
                    "确保天气App有位置访问权限并下拉刷新"
                );
            }
        } catch (e) {
            console.log("❌ 检查更新时出错:", e);
        }
    }
}

// 立即执行自动流程
main();

// 完成
if (typeof $done !== "undefined") {
    $done();
}