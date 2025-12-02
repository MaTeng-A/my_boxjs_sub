// 名称: 优雅GPS拦截
// 描述: 拦截天气GPS坐标并确保正常显示天气数据
// 作者: Assistant
// 版本: 3.0 - 优雅通知版

console.log("🎯 GPS拦截脚本启动");

if (typeof $request !== "undefined") {
    console.log("✅ 拦截到天气请求:", $request.url);
    
    // 提取坐标 - 多种匹配模式
    const url = $request.url;
    let lat, lng;
    
    // 多种URL模式匹配
    const patterns = [
        /weatherkit\.apple\.com\/v1\/weather\/[^\/]+\/([0-9.-]+)\/([0-9.-]+)/,
        /weatherkit\.apple\.com\/v2\/weather\/[^\/]+\/([0-9.-]+)\/([0-9.-]+)/,
        /[?&]lat=([0-9.-]+)[&]?.*[?&]lng=([0-9.-]+)/,
        /[?&]latitude=([0-9.-]+)[&]?.*[?&]longitude=([0-9.-]+)/
    ];
    
    for (let pattern of patterns) {
        const match = url.match(pattern);
        if (match && match[1] && match[2]) {
            lat = parseFloat(match[1]).toFixed(6);
            lng = parseFloat(match[2]).toFixed(6);
            console.log(`🎯 使用模式匹配到坐标: ${lat}, ${lng}`);
            break;
        }
    }
    
    if (lat && lng) {
        console.log(`📍 成功提取坐标: ${lat}, ${lng}`);
        
        // 检查上次位置
        const lastLocationData = $persistentStore.read("accurate_gps_location");
        let isNewLocation = true;
        
        if (lastLocationData) {
            try {
                const lastLocation = JSON.parse(lastLocationData);
                if (lastLocation.latitude === lat && lastLocation.longitude === lng) {
                    isNewLocation = false;
                    console.log("📍 位置相同，但依然会发送通知");
                }
            } catch (e) {
                console.log("❌ 解析历史位置数据失败:", e);
            }
        }
        
        // 保存GPS数据
        const locationData = {
            latitude: lat,
            longitude: lng,
            timestamp: Date.now(),
            source: "weatherkit_apple",
            accuracy: "高精度GPS",
            url: url
        };
        
        $persistentStore.write(JSON.stringify(locationData), "accurate_gps_location");
        $persistentStore.write(Date.now().toString(), "location_timestamp");
        
        console.log("💾 GPS数据已保存");
        
        // 立即获取地址信息并发送通知
        getAddressAndNotify(lat, lng, Date.now(), isNewLocation);
        
    } else {
        console.log("❌ 未找到坐标信息");
        // 直接完成请求
        $done({});
    }
    
} else {
    // 手动检查模式 - 使用优雅的通知格式
    console.log("📊 GPS状态检查");
    
    const locationData = $persistentStore.read("accurate_gps_location");
    const timestamp = $persistentStore.read("location_timestamp");
    
    if (locationData && timestamp) {
        try {
            const location = JSON.parse(locationData);
            const timeDiff = Math.round((Date.now() - parseInt(timestamp)) / 60000);
            const updateTime = new Date(parseInt(timestamp)).toLocaleString('zh-CN');
            
            // 获取详细地址并发送通知
            getAddressAndNotify(location.latitude, location.longitude, parseInt(timestamp), false, timeDiff, updateTime);
            
        } catch (e) {
            console.log("❌ 数据解析失败:", e);
            sendSimpleNotification("❌ GPS状态检查失败", "数据解析错误", e.message);
            $done();
        }
    } else {
        console.log("❌ 无GPS定位数据");
        sendSimpleNotification("📍 GPS定位状态", "等待定位数据", "请打开系统天气App触发GPS定位");
        $done();
    }
}

// 获取地址并发送优雅通知
function getAddressAndNotify(lat, lng, timestamp, isNewLocation, timeDiffMinutes = null, updateTimeStr = null) {
    const TENCENT_TOKEN = "F7NBZ-MC3R3-6AV3J-RR75X-KKDTE-EKFLQ";
    const geocoderUrl = `https://apis.map.qq.com/ws/geocoder/v1/?key=${TENCENT_TOKEN}&location=${lat},${lng}`;
    
    console.log("🗺️ 获取详细地址信息...");
    
    $httpClient.get(geocoderUrl, function(error, response, data) {
        let addressText = "";
        let fullAddress = "";
        
        if (!error && response.status === 200) {
            try {
                const result = JSON.parse(data);
                if (result.status === 0) {
                    const address = result.result.address_component;
                    
                    // 构建地址文本（省市区街道）
                    addressText = `${address.province || ''}${address.city || ''}${address.district || ''}`;
                    
                    // 获取详细地址
                    fullAddress = result.result.formatted_addresses?.recommend || result.result.address || addressText;
                    
                    // 如果有道路信息，添加到地址文本
                    if (address.street) {
                        addressText += address.street;
                        if (address.street_number) {
                            addressText += address.street_number;
                        }
                    }
                    
                    console.log("✅ 地址解析成功:", addressText);
                } else {
                    addressText = "地址解析失败";
                    fullAddress = `错误码: ${result.status}`;
                }
            } catch (e) {
                addressText = "地址数据解析错误";
                fullAddress = e.message;
            }
        } else {
            addressText = "网络请求失败";
            fullAddress = error || `状态码: ${response?.status}`;
        }
        
        // 准备通知内容
        const now = Date.now();
        const timeDiff = timeDiffMinutes !== null ? timeDiffMinutes : Math.round((now - timestamp) / 60000);
        const updateTime = updateTimeStr || new Date(timestamp).toLocaleString('zh-CN');
        
        // 构建优雅的通知格式
        const title = isNewLocation ? "📍 新位置已获取" : "📍 GPS定位状态";
        const subtitle = addressText || "未知位置";
        
        let body = "";
        if (addressText && fullAddress && addressText !== fullAddress) {
            // 如果详细地址与短地址不同，显示两者
            body += `${addressText}\n`;
            body += `更新时间: ${timeDiff}分钟前\n`;
            body += `数据来源: weatherkit_apple\n`;
            body += `坐标精度: 高精度GPS\n`;
            body += `经纬度: ${lat}, ${lng}\n\n`;
            body += `详细地址:\n${fullAddress}\n\n`;
            body += `${timeDiff}分钟前`;
        } else {
            // 如果地址相同，只显示一次
            body += `${addressText || fullAddress}\n`;
            body += `更新时间: ${timeDiff}分钟前\n`;
            body += `数据来源: weatherkit_apple\n`;
            body += `坐标精度: 高精度GPS\n`;
            body += `经纬度: ${lat}, ${lng}\n\n`;
            body += `${timeDiff}分钟前`;
        }
        
        // 发送通知
        $notification.post(title, subtitle, body);
        
        console.log(`📍 发送通知 - 坐标: ${lat}, ${lng}, 时间差: ${timeDiff}分钟`);
        
        // 如果是拦截模式，还需要完成请求
        if (typeof $request !== "undefined") {
            $done({});
        } else {
            $done();
        }
    });
}

// 发送简单通知的辅助函数
function sendSimpleNotification(title, subtitle, body) {
    $notification.post(title, subtitle, body);
    if (typeof $request !== "undefined") {
        $done({});
    } else {
        $done();
    }
}