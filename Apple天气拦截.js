// 名称: 苹果天气GPS拦截器
// 描述: 精准拦截苹果天气的GPS坐标并发送详细通知
// 版本: 8.0 - 完整优化版
// 作者: MaTeng-A
// 更新时间: 2025-12-02

console.log("🎯 苹果天气GPS拦截器启动");

const isRequest = typeof $request !== 'undefined';
console.log(`📱 运行模式: ${isRequest ? '拦截请求' : '手动检查'}`);

if (isRequest) {
    handleRequest($request);
} else {
    handleManualCheck();
}

function handleRequest(request) {
    const url = request.url;
    
    console.log("📡 拦截到请求:", url.substring(0, 100) + (url.length > 100 ? "..." : ""));
    
    // 只处理天气应用的请求
    if (!url.includes('weatherkit.apple.com')) {
        console.log("🚫 非天气应用请求，跳过处理");
        $done({});
        return;
    }
    
    console.log("🌤️ 识别为天气应用请求");
    const coords = extractWeatherCoordinates(url);
    
    if (coords && isValidCoordinate(coords.lat, coords.lng)) {
        const lat = coords.lat;
        const lng = coords.lng;
        console.log(`✅ 成功提取有效坐标: ${lat}, ${lng}`);
        
        // 保存GPS数据
        saveLocationData(lat, lng);
        
        // 检查是否需要发送通知（总是发送，但检查是否相同位置）
        checkAndSendNotification(lat, lng, "weatherkit_apple");
        
    } else {
        console.log("❌ 未找到有效坐标");
    }
    
    $done({});
}

function handleManualCheck() {
    console.log("📊 GPS状态手动检查");
    
    const locationData = $persistentStore.read("gps_location_data");
    const timestamp = $persistentStore.read("gps_timestamp");
    
    if (locationData && timestamp) {
        try {
            const data = JSON.parse(locationData);
            const currentTime = Date.now();
            const timeDiff = Math.round((currentTime - data.timestamp) / 60000);
            
            // 手动检查时总是发送通知
            getDetailedAddressAndNotify(data.latitude, data.longitude, "weatherkit_apple", data.timestamp, timeDiff);
            
        } catch (e) {
            console.log("❌ 数据解析失败:", e);
            sendSimpleNotification("❌ GPS状态检查失败", "数据解析错误", e.message);
            $done();
        }
    } else {
        console.log("❌ 无GPS定位数据");
        sendSimpleNotification("📍 GPS定位状态", "等待定位数据", "请打开天气App触发定位");
        $done();
    }
}

// 提取天气应用坐标
function extractWeatherCoordinates(url) {
    // 多种坐标提取模式
    const weatherPatterns = [
        // 模式1: URL路径中的坐标
        /weatherkit\.apple\.com\/v[12]\/weather\/[^\/]+\/([0-9.-]+)\/([0-9.-]+)/,
        // 模式2: lat和lng参数
        /[?&]lat=([0-9.-]+)[^&]*[?&]lng=([0-9.-]+)/i,
        // 模式3: latitude和longitude参数
        /[?&]latitude=([0-9.-]+)[^&]*[?&]longitude=([0-9.-]+)/i,
        // 模式4: 坐标对格式
        /[?&]location=([0-9.-]+)%2C([0-9.-]+)/i,
        // 模式5: 逗号分隔的坐标
        /[?&]coords=([0-9.-]+),([0-9.-]+)/i
    ];
    
    for (let pattern of weatherPatterns) {
        const match = url.match(pattern);
        if (match && match[1] && match[2]) {
            let lat = parseFloat(match[1]).toFixed(6);
            let lng = parseFloat(match[2]).toFixed(6);
            
            // 简化显示：去掉末尾的0
            lat = simplifyCoordinate(lat);
            lng = simplifyCoordinate(lng);
            
            // 验证坐标范围
            if (isValidCoordinate(lat, lng)) {
                console.log(`🌤️ 从天气URL提取坐标: ${lat}, ${lng}`);
                return { lat, lng };
            }
        }
    }
    
    // 如果以上模式都不匹配，尝试从URL的其他部分查找
    const generalPattern = /[?&](?:lat|latitude)=([0-9.-]+).*?[?&](?:lng|longitude)=([0-9.-]+)/i;
    const generalMatch = url.match(generalPattern);
    if (generalMatch && generalMatch[1] && generalMatch[2]) {
        let lat = parseFloat(generalMatch[1]).toFixed(6);
        let lng = parseFloat(generalMatch[2]).toFixed(6);
        
        lat = simplifyCoordinate(lat);
        lng = simplifyCoordinate(lng);
        
        if (isValidCoordinate(lat, lng)) {
            console.log(`🌤️ 从通用模式提取坐标: ${lat}, ${lng}`);
            return { lat, lng };
        }
    }
    
    return null;
}

// 简化坐标显示
function simplifyCoordinate(coord) {
    let num = parseFloat(coord);
    
    // 如果是整数，直接返回整数形式
    if (num % 1 === 0) {
        return num.toString();
    }
    
    // 去掉末尾的0，保留最多6位小数
    return num.toFixed(6).replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');
}

// 验证坐标有效性
function isValidCoordinate(lat, lng) {
    const latNum = parseFloat(lat);
    const lngNum = parseFloat(lng);
    
    if (isNaN(latNum) || isNaN(lngNum)) {
        return false;
    }
    
    // 有效纬度范围：-90 到 90
    if (latNum < -90 || latNum > 90) {
        console.log(`❌ 纬度 ${lat} 超出有效范围(-90~90)`);
        return false;
    }
    
    // 有效经度范围：-180 到 180
    if (lngNum < -180 || lngNum > 180) {
        console.log(`❌ 经度 ${lng} 超出有效范围(-180~180)`);
        return false;
    }
    
    return true;
}

// 保存位置数据
function saveLocationData(lat, lng) {
    const now = Date.now();
    const locationData = {
        latitude: lat,
        longitude: lng,
        timestamp: now,
        appName: "weatherkit_apple",
        accuracy: "高精度GPS",
        source: "weatherkit"
    };
    
    $persistentStore.write(JSON.stringify(locationData), "gps_location_data");
    $persistentStore.write(now.toString(), "gps_timestamp");
    
    console.log("💾 GPS数据已保存");
    
    // 异步获取地址信息
    getAddressAsync(lat, lng);
}

// 异步获取地址信息
function getAddressAsync(lat, lng) {
    const TENCENT_TOKEN = "F7NBZ-MC3R3-6AV3J-RR75X-KKDTE-EKFLQ";
    const geocoderUrl = `https://apis.map.qq.com/ws/geocoder/v1/?key=${TENCENT_TOKEN}&location=${lat},${lng}`;
    
    $httpClient.get(geocoderUrl, function(error, response, data) {
        if (!error && response.status === 200) {
            try {
                const result = JSON.parse(data);
                if (result.status === 0) {
                    const address = result.result.address_component;
                    const addressText = `${address.province || ''}${address.city || ''}${address.district || ''}`;
                    
                    // 更新保存的位置数据
                    const locationData = JSON.parse($persistentStore.read("gps_location_data") || "{}");
                    locationData.address = addressText;
                    locationData.fullAddress = result.result.formatted_addresses?.recommend || result.result.address;
                    $persistentStore.write(JSON.stringify(locationData), "gps_location_data");
                    
                    console.log("📍 地址信息已保存:", addressText);
                }
            } catch (e) {
                console.log("❌ 地址解析失败:", e);
            }
        }
    });
}

// 检查是否需要发送通知
function checkAndSendNotification(lat, lng, source) {
    const lastLocationData = $persistentStore.read("gps_location_data");
    const currentTime = Date.now();
    
    let shouldSend = true;
    
    // 检查是否是新位置
    if (lastLocationData) {
        try {
            const lastData = JSON.parse(lastLocationData);
            const lastLat = parseFloat(lastData.latitude);
            const lastLng = parseFloat(lastData.longitude);
            const currLat = parseFloat(lat);
            const currLng = parseFloat(lng);
            
            // 计算距离（简化版，使用平面距离）
            const latDiff = Math.abs(currLat - lastLat);
            const lngDiff = Math.abs(currLng - lastLng);
            
            // 如果位置变化很小（小于0.0001度，约10米），且时间较短，可能不需要通知
            // 但根据您的要求，只要超过30分钟就通知，这里我们只做位置判断
            const lastTime = lastData.timestamp || 0;
            const timeDiff = (currentTime - lastTime) / 60000; // 分钟
            
            if (latDiff < 0.0001 && lngDiff < 0.0001 && timeDiff < 30) {
                console.log(`📍 位置变化很小 (${latDiff.toFixed(6)}, ${lngDiff.toFixed(6)}), 时间差 ${timeDiff.toFixed(1)} 分钟`);
                // 可以根据需要决定是否发送通知
                // 这里我们根据时间决定：超过30分钟就发送
                if (timeDiff < 30) {
                    console.log("⏰ 距离上次定位不到30分钟，跳过通知");
                    shouldSend = false;
                }
            }
        } catch (e) {
            console.log("⚠️ 解析历史位置数据失败:", e);
        }
    }
    
    if (shouldSend) {
        console.log("📲 准备发送通知");
        // 获取详细地址并发送通知
        getDetailedAddressAndNotify(lat, lng, source, currentTime, 0);
    }
}

// 获取详细地址并发送通知
function getDetailedAddressAndNotify(lat, lng, source, timestamp, timeDiffMinutes) {
    const TENCENT_TOKEN = "F7NBZ-MC3R3-6AV3J-RR75X-KKDTE-EKFLQ";
    const geocoderUrl = `https://apis.map.qq.com/ws/geocoder/v1/?key=${TENCENT_TOKEN}&location=${lat},${lng}`;
    
    console.log("🗺️ 获取详细地址信息...");
    
    $httpClient.get(geocoderUrl, function(error, response, data) {
        let addressText = "地址解析中...";
        let detailedAddress = "";
        
        if (!error && response.status === 200) {
            try {
                const result = JSON.parse(data);
                if (result.status === 0) {
                    const address = result.result.address_component;
                    addressText = `${address.province || ''}${address.city || ''}${address.district || ''}`;
                    
                    // 详细地址
                    detailedAddress = result.result.formatted_addresses?.recommend || result.result.address || addressText;
                    
                    // 如果有街道信息，添加到地址文本
                    if (address.street) {
                        addressText += address.street;
                        if (address.street_number) {
                            addressText += address.street_number;
                        }
                    }
                    
                    // 特殊情况：如果地址信息为空，使用更详细的信息
                    if (addressText.length < 3) {
                        addressText = detailedAddress || "详细地址获取失败";
                    }
                    
                    console.log("✅ 地址解析成功:", addressText);
                    
                    // 更新保存的地址信息
                    const locationData = JSON.parse($persistentStore.read("gps_location_data") || "{}");
                    locationData.address = addressText;
                    locationData.detailedAddress = detailedAddress;
                    $persistentStore.write(JSON.stringify(locationData), "gps_location_data");
                    
                } else {
                    console.log("❌ 腾讯地图API错误:", result.message);
                    addressText = "地址解析失败";
                }
            } catch (e) {
                console.log("❌ 地址数据解析错误:", e);
                addressText = "地址解析异常";
            }
        } else {
            console.log("❌ 网络请求失败:", error || response.status);
            addressText = "网络请求失败";
        }
        
        // 格式化时间（精确到分钟）
        const updateTime = new Date(timestamp).toLocaleString('zh-CN', {
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        }).replace(/\//g, '-');
        
        // 构建通知内容
        let title = "📍 GPS定位成功";
        let subtitle = addressText;
        let body = "";
        
        if (timeDiffMinutes > 0) {
            title = "📍 GPS定位状态";
            body += `数据来源: ${source}\n`;
        } else {
            body += `拦截时间: ${updateTime}\n`;
            body += `数据来源: ${source}\n`;
        }
        
        body += `坐标精度: 高精度GPS\n`;
        body += `经纬度: ${lat}, ${lng}\n\n`;
        
        // 添加详细地址
        if (detailedAddress && detailedAddress !== addressText) {
            body += `详细地址:\n${detailedAddress}`;
        } else {
            body += `详细地址:\n${addressText}`;
        }
        
        // 发送通知
        $notification.post(title, subtitle, body);
        console.log("📲 已发送通知");
        
        // 如果是手动检查模式，需要调用$done
        if (timeDiffMinutes > 0 || !isRequest) {
            $done();
        }
    });
}

// 发送简单通知
function sendSimpleNotification(title, subtitle, body) {
    $notification.post(title, subtitle, body);
    $done();
}