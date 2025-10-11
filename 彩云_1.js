// 名称: 稳定精准天气日报 (Loon增强GPS定位修复版)
// 描述: 基于苹果天气GPS定位 + 腾讯地图IP定位，包含诗句和明日预报
// 作者: Assistant  
// 更新时间: 2025-10-09
// 支持平台: Loon

// === API 配置 ===
const CAIYUN_TOKEN = "iaJd9yTvsg3496vi";
const TENCENT_TOKEN = "F7NBZ-MC3R3-6AV3J-RR75X-KKDTE-EKFLQ";
const TIANAPI_KEY1 = "8fb6b3bc5bbe9ee420193601d13f9162";
const TIANAPI_KEY2 = "8fb6b3bc5bbe9ee420193601d13f9162";

// === 存储键名 ===
const GPS_LOCATION_KEY = "gps_location_data";
const LOCATION_TIMESTAMP_KEY = "location_timestamp";
const LAST_NOTIFICATION_TIME = "last_notification_time";

// === 主入口判断 ===
if (typeof $request !== "undefined") {
    // 拦截模式 - 从苹果天气请求获取GPS定位
    handleAppleWeatherRequest();
} else {
    // 定时任务模式 - 获取天气信息
    main();
}

// === 拦截苹果天气请求 ===
function handleAppleWeatherRequest() {
    console.log("📍 拦截到苹果天气请求");
    
    try {
        const url = $request.url;
        let lat, lng;
        
        // 多种匹配模式提取经纬度
        const res1 = url.match(/weather\/.*?\/(.*)\/(.*)\?/);
        const res2 = url.match(/geocode\/([0-9.]*)\/([0-9.]*)\//);
        const res3 = url.match(/geocode=([0-9.]*),([0-9.]*)/);
        const res4 = url.match(/v2\/availability\/([0-9.]*)\/([0-9.]*)\//);
        
        const res = res1 || res2 || res3 || res4;
        
        if (res) {
            lat = res[1];
            lng = res[2];
            
            const locationData = {
                latitude: parseFloat(lat),
                longitude: parseFloat(lng),
                source: "apple_weather_gps",
                timestamp: new Date().getTime(),
                accuracy: "high" // GPS定位精度高
            };
            
            // 保存GPS定位数据 - 3小时缓存
            $persistentStore.write(JSON.stringify(locationData), GPS_LOCATION_KEY);
            $persistentStore.write(locationData.timestamp.toString(), LOCATION_TIMESTAMP_KEY);
            
            console.log(`📍 GPS定位成功: ${lat}, ${lng}`);
            console.log(`📍 GPS数据已保存: ${JSON.stringify(locationData)}`);
            
            // 可选：发送成功通知
            $notification.post(
                "📍 GPS定位更新", 
                `精度: ${lat.substring(0, 8)}, ${lng.substring(0, 8)}`,
                "通过苹果天气服务获取的精确位置"
            );
        } else {
            console.log("❌ 无法从URL提取经纬度:", url);
        }
        
    } catch (error) {
        console.log("❌ 拦截处理失败:", error);
    }
    
    $done({});
}

// === 主函数 ===
function main() {
    console.log("🌤️ 开始获取天气信息...");
    
    // 检查是否是22:17及之后
    const isLastRun = isLastRunTime();
    console.log(`最后运行时段(22:17及之后): ${isLastRun}`);
    
    if (isLastRun) {
        // 22:17及之后的特殊处理
        handleLastRunWeather();
    } else {
        // 正常时段的处理
        getBestLocation()
            .then(location => {
                if (location) {
                    console.log(`📍 使用${location.source}定位: ${location.latitude}, ${location.longitude}`);
                    console.log(`📍 位置详情: ${location.province || ''}${location.city || ''}${location.district || ''}`);
                    getCaiyunWeather(location.latitude, location.longitude, location.province, location.city, location.district, false);
                } else {
                    handleError("定位失败", "无法获取任何位置信息");
                }
            })
            .catch(error => {
                handleError("定位获取失败", error.message);
            });
    }
}

// === 处理22:17及之后的天气通知 ===
function handleLastRunWeather() {
    console.log("🌙 22:17及之后，准备发送双重通知");
    
    getBestLocation()
        .then(location => {
            if (location) {
                console.log(`📍 使用${location.source}定位: ${location.latitude}, ${location.longitude}`);
                console.log(`📍 位置详情: ${location.province || ''}${location.city || ''}${location.district || ''}`);
                
                // 先获取当天天气数据
                getCaiyunWeather(location.latitude, location.longitude, location.province, location.city, location.district, true);
            } else {
                handleError("定位失败", "无法获取任何位置信息");
            }
        })
        .catch(error => {
            handleError("定位获取失败", error.message);
        });
}

// === 获取最佳位置信息 ===
function getBestLocation() {
    return new Promise((resolve, reject) => {
        // 1. 优先尝试读取GPS定位 - 3小时有效
        const gpsData = $persistentStore.read(GPS_LOCATION_KEY);
        const gpsTimestamp = $persistentStore.read(LOCATION_TIMESTAMP_KEY);
        
        console.log(`📍 检查GPS缓存数据: ${gpsData ? '存在' : '不存在'}`);
        console.log(`📍 GPS时间戳: ${gpsTimestamp}`);
        
        if (gpsData && gpsTimestamp) {
            try {
                const location = JSON.parse(gpsData);
                const now = new Date().getTime();
                const timeDiff = now - parseInt(gpsTimestamp);
                
                console.log(`📍 GPS数据时间差: ${Math.round(timeDiff/1000/60)}分钟, 限制: 180分钟`);
                
                // GPS数据在3小时内有效
                if (timeDiff < 3 * 60 * 60 * 1000) {
                    console.log("✅ 使用缓存的GPS定位数据");
                    
                    // 如果GPS数据已经有地址信息，直接使用
                    if (location.province && location.city) {
                        console.log("✅ GPS数据包含完整地址信息");
                        resolve(location);
                        return;
                    }
                    
                    // 否则获取地址信息
                    getAddressFromCoordinates(location.latitude, location.longitude)
                        .then(address => {
                            const fullLocation = {
                                ...location,
                                ...address
                            };
                            // 更新缓存中的地址信息
                            $persistentStore.write(JSON.stringify(fullLocation), GPS_LOCATION_KEY);
                            resolve(fullLocation);
                        })
                        .catch((error) => {
                            console.log("❌ 地址获取失败，但仍使用GPS坐标:", error);
                            // 即使地址获取失败，也使用GPS坐标
                            resolve(location);
                        });
                    return;
                } else {
                    console.log("📝 GPS定位数据已过期，重新获取");
                }
            } catch (e) {
                console.log("❌ GPS定位数据解析失败:", e);
            }
        } else {
            console.log("❌ 没有可用的GPS缓存数据");
        }
        
        // 2. 降级到腾讯地图IP定位
        console.log("🔄 降级到IP定位");
        getIPLocation()
            .then(location => {
                console.log("✅ IP定位成功:", JSON.stringify(location));
                resolve(location);
            })
            .catch(error => {
                console.log("❌ IP定位失败:", error);
                reject(error);
            });
    });
}

// === 腾讯地图IP定位 ===
function getIPLocation() {
    return new Promise((resolve, reject) => {
        const ipUrl = `https://apis.map.qq.com/ws/location/v1/ip?key=${TENCENT_TOKEN}`;
        
        console.log("📍 开始IP定位请求");
        
        $httpClient.get(ipUrl, function(error, response, data) {
            if (error) {
                console.log("❌ IP定位请求失败:", error);
                reject(new Error("IP定位失败: " + error));
                return;
            }
            
            try {
                console.log("📍 IP定位响应:", data);
                const result = JSON.parse(data);
                
                if (result.status === 0) {
                    const location = result.result;
                    const locationData = {
                        latitude: location.location.lat,
                        longitude: location.location.lng,
                        province: location.ad_info.province,
                        city: location.ad_info.city,
                        district: location.ad_info.district,
                        source: "tencent_ip",
                        accuracy: "medium",
                        timestamp: new Date().getTime()
                    };
                    
                    console.log("✅ IP定位成功:", JSON.stringify(locationData));
                    resolve(locationData);
                } else {
                    console.log("❌ IP定位服务返回错误:", result.message);
                    reject(new Error("IP定位服务返回错误: " + result.message));
                }
                
            } catch (e) {
                console.log("❌ IP定位数据解析失败:", e);
                reject(new Error("IP定位数据解析失败: " + e.message));
            }
        });
    });
}

// === 根据坐标获取地址信息 ===
function getAddressFromCoordinates(lat, lng) {
    return new Promise((resolve, reject) => {
        const geocoderUrl = `https://apis.map.qq.com/ws/geocoder/v1/?key=${TENCENT_TOKEN}&location=${lat},${lng}`;
        
        console.log("📍 开始逆地理编码请求");
        
        $httpClient.get(geocoderUrl, function(error, response, data) {
            if (error) {
                console.log("❌ 逆地理编码请求失败:", error);
                reject(error);
                return;
            }
            
            try {
                console.log("📍 逆地理编码响应:", data);
                const result = JSON.parse(data);
                if (result.status === 0) {
                    const address = result.result.address_component;
                    const addressInfo = {
                        province: address.province,
                        city: address.city,
                        district: address.district
                    };
                    console.log("✅ 逆地理编码成功:", JSON.stringify(addressInfo));
                    resolve(addressInfo);
                } else {
                    console.log("❌ 逆地理编码失败:", result.message);
                    reject(new Error("逆地理编码失败"));
                }
            } catch (e) {
                console.log("❌ 逆地理编码数据解析失败:", e);
                reject(e);
            }
        });
    });
}

// === 获取彩云天气 ===
function getCaiyunWeather(lat, lng, province, city, district, isLastRun) {
    const weatherUrl = `https://api.caiyunapp.com/v2.6/${CAIYUN_TOKEN}/${lng},${lat}/weather?alert=true`;
    
    console.log("⏳ 获取彩云天气数据...");
    console.log(`📍 请求URL: ${weatherUrl}`);
    
    $httpClient.get(weatherUrl, function(error, response, data) {
        if (error) {
            console.log("❌ 天气获取失败:", error);
            handleError("天气获取失败", error);
            return;
        }
        
        try {
            const weatherData = JSON.parse(data);
            console.log("✅ 天气数据获取成功，状态:", weatherData.status);
            
            if (weatherData.status === "ok") {
                if (isLastRun) {
                    // 22:17及之后，先发送当天天气，然后延迟发送明日天气
                    handleDualNotification(weatherData, province, city, district);
                } else {
                    // 正常时段显示当天天气+诗句
                    getTianapiData(weatherData, province, city, district);
                }
            } else {
                console.log("❌ 天气API返回错误:", weatherData.error);
                handleError("天气获取失败", weatherData.error || "未知错误");
            }
        } catch (e) {
            console.log("❌ 天气数据解析失败:", e);
            handleError("天气数据解析失败", e.message);
        }
    });
}

// === 处理双重通知（22:17及之后）===
function handleDualNotification(weatherData, province, city, district) {
    console.log("🔄 处理双重通知流程");
    
    // 先发送当天天气通知（不带诗句）
    processTodayWeather(weatherData, province, city, district, "今日天气总结");
    
    // 延迟1秒后发送明日天气预报
    console.log("⏰ 设置1秒后发送明日天气预报");
    $done(); // 先结束当前执行
    
    // 使用setTimeout实现延迟
    setTimeout(() => {
        console.log("🕐 延迟时间到，发送明日天气预报");
        processTomorrowWeather(weatherData, province, city, district);
    }, 1000);
}

// === 获取天行数据（诗句）===
function getTianapiData(weatherData, province, city, district) {
    const skycon = weatherData.result.realtime.skycon;
    const tqtype = getTianapiWeatherType(skycon);
    
    let poetryUrl = `https://api.tianapi.com/tianqishiju/index?key=${TIANAPI_KEY1}`;
    if (tqtype) {
        poetryUrl += `&tqtype=${tqtype}`;
        console.log(`📜 使用指定天气类型: ${tqtype}`);
    } else {
        console.log("📜 使用随机天气诗句");
    }
    
    console.log("📜 获取天气诗句...");
    
    $httpClient.get(poetryUrl, function(error, response, poetryData) {
        let poetry = "今日天气宜人，愿您心情舒畅。";
        if (!error) {
            try {
                const poetryJson = JSON.parse(poetryData);
                if (poetryJson.code === 200 && poetryJson.newslist && poetryJson.newslist.length > 0) {
                    poetry = poetryJson.newslist[0].content;
                    console.log("✅ 天气诗句获取成功:", poetry);
                }
            } catch (e) {
                console.log("❌ 天气诗句获取失败:", e);
            }
        } else {
            console.log("❌ 天气诗句请求失败:", error);
        }
        
        // 处理当天天气数据
        processTodayWeather(weatherData, province, city, district, poetry);
    });
}

// === 处理当天天气数据 ===
function processTodayWeather(weatherData, province, city, district, poetry) {
    try {
        const realtime = weatherData.result.realtime;
        const hourly = weatherData.result.hourly;
        const daily = weatherData.result.daily;
        const alert = weatherData.result.alert;
        const keypoint = weatherData.result.forecast_keypoint;
        
        // 当前天气数据
        const temperature = Math.round(realtime.temperature);
        const apparentTemperature = Math.round(realtime.apparent_temperature);
        const humidity = Math.round(realtime.humidity * 100);
        const windSpeed = Math.round(realtime.wind.speed);
        const windDirection = getWindDirection(realtime.wind.direction);
        const pressure = Math.round(realtime.pressure / 100);
        const visibility = (realtime.visibility / 1000).toFixed(1);
        const skycon = realtime.skycon;
        const weatherDesc = getWeatherDescription(skycon);
        const airQuality = realtime.air_quality ? realtime.air_quality.description.chn : "未知";
        const pm25 = realtime.air_quality ? Math.round(realtime.air_quality.pm25) : "未知";
        
        // 生活指数
        const comfort = realtime.life_index.comfort ? realtime.life_index.comfort.desc : "暂无数据";
        const ultraviolet = realtime.life_index.ultraviolet ? realtime.life_index.ultraviolet.desc : "暂无数据";
        
        // 今日温度范围
        const maxTemp = Math.round(daily.temperature[0].max);
        const minTemp = Math.round(daily.temperature[0].min);
        
        // 获取天气图标
        const weatherIconUrl = getWeatherIcon(skycon);
        
        // 构建通知内容
        const title = poetry === "今日天气总结" ? "🌤️ 今日天气总结" : "🌤️ 诗意天气日报";
        const subtitle = `📍${province}${city}${district} (${minTemp}°C~${maxTemp}°C) | ${temperature}°C | ${weatherDesc}`;
        
        let body = "";
        
        // 空气质量信息
        body += `🌫️ 空气质量: ${airQuality}   🫧 PM2.5: ${pm25}\n`;
        body += `🌡️ 体感${comfort} ${apparentTemperature}°C   💧 湿度 ${humidity}%\n`;
        body += `🌬️ ${windDirection}风 ${windSpeed}km/h   📊 气压 ${pressure}hPa\n`;
        body += `👁️ 能见度 ${visibility}km   ☀️ 紫外线${ultraviolet}\n\n`;
        
        // 未来三小时预报
        let hourlyForecast = "";
        for (let i = 0; i < 3 && i < hourly.skycon.length; i++) {
            const hourTime = new Date(hourly.skycon[i].datetime);
            const currentHour = hourTime.getHours();
            const nextHour = currentHour + 1;
            const temp = Math.round(hourly.temperature[i].value);
            const hourSkycon = hourly.skycon[i].value;
            const hourDesc = getWeatherDescription(hourSkycon);
            
            hourlyForecast += `      ${currentHour.toString().padStart(2, '0')}-${nextHour.toString().padStart(2, '0')}时 ${hourDesc} ${temp}°C\n`;
        }
        
        if (hourlyForecast) {
            body += `⏰ 未来三小时预报:\n${hourlyForecast}\n`;
        }
        
        // 预警信息
        if (alert && alert.content && alert.content.length > 0) {
            body += "⚠️ 天气预警:\n";
            alert.content.forEach((alertItem, index) => {
                if (index < 2) {
                    body += `   • ${alertItem.title}\n`;
                }
            });
            body += "\n";
        }
        
        // 关键点内容
        if (keypoint) {
            body += `💡 ${keypoint}\n`;
        }
        
        // 诗句（如果不是总结模式）
        if (poetry !== "今日天气总结") {
            body += `📜 ${poetry}`;
        }
        
        console.log("✅ 准备发送当天天气通知");
        
        // 发送通知
        $notification.post(title, subtitle, body, {
            "icon": weatherIconUrl
        });
        
        // 只在非双重通知模式下结束
        if (!isLastRunTime() || poetry === "今日天气总结") {
            console.log("✅ 当天天气通知发送完成");
            if (poetry !== "今日天气总结") {
                $done();
            }
        }
        
    } catch (e) {
        console.log("❌ 天气数据处理失败:", e);
        handleError("天气数据处理失败", e.message);
    }
}

// === 处理明日天气预报 ===
function processTomorrowWeather(weatherData, province, city, district) {
    try {
        const daily = weatherData.result.daily;
        const realtime = weatherData.result.realtime;
        
        // 获取第二天天气信息
        const tomorrowTemp = daily.temperature[1];
        const tomorrowMaxTemp = Math.round(tomorrowTemp.max);
        const tomorrowMinTemp = Math.round(tomorrowTemp.min);
        const tomorrowSkycon = daily.skycon[1].value;
        const tomorrowWeatherDesc = getWeatherDescription(tomorrowSkycon);
        
        // 日出日落时间
        const sunriseTime = daily.astro[1].sunrise.time;
        const sunsetTime = daily.astro[1].sunset.time;
        
        // 穿衣建议和带伞提醒
        const dressingAdvice = getDressingAdvice(tomorrowMaxTemp, tomorrowWeatherDesc);
        const umbrellaAdvice = getUmbrellaAdvice(tomorrowWeatherDesc);
        
        // 获取明日天气图标
        const tomorrowWeatherIconUrl = getWeatherIcon(tomorrowSkycon);
        
        // 当前天气简要信息
        const currentTemp = Math.round(realtime.temperature);
        const airQuality = realtime.air_quality ? realtime.air_quality.description.chn : "未知";
        
        const title = "🌙 明日天气预告";
        const subtitle = `📍${province}${city}${district} 明日${tomorrowWeatherDesc}`;
        
        let body = "";
        body += `🌡️ 温度范围: ${tomorrowMinTemp}°C ~ ${tomorrowMaxTemp}°C\n`;
        body += `🌈 天气状况: ${tomorrowWeatherDesc}\n\n`;
        body += `${dressingAdvice}\n`;
        body += `${umbrellaAdvice}\n\n`;
        body += `🌅 日出: ${sunriseTime}   🌇 日落: ${sunsetTime}\n\n`;
        body += `📊 当前温度: ${currentTemp}°C | 空气质量: ${airQuality}`;
        
        console.log("✅ 准备发送明日天气预报");
        
        // 发送通知
        $notification.post(title, subtitle, body, {
            "icon": tomorrowWeatherIconUrl
        });
        
        console.log("✅ 明日天气通知发送完成");
        
    } catch (e) {
        console.log("❌ 明日天气数据处理失败:", e);
        handleError("明日天气数据处理失败", e.message);
    }
}

// === 辅助函数 ===

// 检查是否是22:17及之后
function isLastRunTime() {
    const now = new Date();
    const hour = now.getHours();
    const minute = now.getMinutes();
    const isLastRun = hour > 22 || (hour === 22 && minute >= 17);
    console.log(`🕐 当前时间: ${hour}:${minute}, 最后运行时段: ${isLastRun}`);
    return isLastRun;
}

// 天气图标映射
function getWeatherIcon(skycon) {
    const iconMap = {
        "CLEAR_DAY": "https://raw.githubusercontent.com/58xinian/icon/master/Weather/CLEAR_DAY.gif",
        "CLEAR_NIGHT": "https://raw.githubusercontent.com/58xinian/icon/master/Weather/CLEAR_NIGHT.gif",
        "PARTLY_CLOUDY_DAY": "https://raw.githubusercontent.com/58xinian/icon/master/Weather/PARTLY_CLOUDY_DAY.gif",
        "PARTLY_CLOUDY_NIGHT": "https://raw.githubusercontent.com/58xinian/icon/master/Weather/PARTLY_CLOUDY_NIGHT.gif",
        "CLOUDY": "https://raw.githubusercontent.com/58xinian/icon/master/Weather/CLOUDY.gif",
        "LIGHT_RAIN": "https://raw.githubusercontent.com/58xinian/icon/master/Weather/LIGHT_RAIN.gif",
        "MODERATE_RAIN": "https://raw.githubusercontent.com/58xinian/icon/master/Weather/MODERATE_RAIN.gif",
        "HEAVY_RAIN": "https://raw.githubusercontent.com/58xinian/icon/master/Weather/HEAVY_RAIN.gif",
        "STORM_RAIN": "https://raw.githubusercontent.com/58xinian/icon/master/Weather/STORM_RAIN.gif",
        "LIGHT_SNOW": "https://raw.githubusercontent.com/58xinian/icon/master/Weather/LIGHT_SNOW.gif",
        "MODERATE_SNOW": "https://raw.githubusercontent.com/58xinian/icon/master/Weather/MODERATE_SNOW.gif",
        "HEAVY_SNOW": "https://raw.githubusercontent.com/58xinian/icon/master/Weather/HEAVY_SNOW.gif",
        "STORM_SNOW": "https://raw.githubusercontent.com/58xinian/icon/master/Weather/HEAVY_SNOW.gif",
        "FOG": "https://raw.githubusercontent.com/58xinian/icon/master/Weather/FOG.gif",
        "WIND": "https://raw.githubusercontent.com/58xinian/icon/master/Weather/WIND.gif",
        "HAZE": "https://raw.githubusercontent.com/58xinian/icon/master/Weather/HAZE.gif"
    };
    return iconMap[skycon] || "https://raw.githubusercontent.com/58xinian/icon/master/Weather/CLOUDY.gif";
}

// 天气描述映射
function getWeatherDescription(skycon) {
    const descMap = {
        "CLEAR_DAY": "☀️ 晴朗", "CLEAR_NIGHT": "✨ 晴朗",
        "PARTLY_CLOUDY_DAY": "⛅ 多云", "PARTLY_CLOUDY_NIGHT": "☁️ 多云",
        "CLOUDY": "☁️ 阴天", "LIGHT_RAIN": "🌦️ 小雨", 
        "MODERATE_RAIN": "🌧️ 中雨", "HEAVY_RAIN": "⛈️ 大雨",
        "STORM_RAIN": "🌩️ 暴雨", "LIGHT_SNOW": "❄️ 小雪",
        "MODERATE_SNOW": "🌨️ 中雪", "HEAVY_SNOW": "☃️ 大雪",
        "STORM_SNOW": "❄️ 暴雪", "FOG": "🌫️ 雾天",
        "WIND": "💨 大风", "HAZE": "😷 雾霾"
    };
    return descMap[skycon] || "🌤️ 未知";
}

// 风向描述
function getWindDirection(degree) {
    const directions = ["北", "北东北", "东北", "东东北", "东", "东东南", "东南", "南东南", 
                       "南", "南西南", "西南", "西西南", "西", "西西北", "西北", "北西北"];
    const index = Math.round(((degree %= 360) < 0 ? degree + 360 : degree) / 22.5) % 16;
    return directions[index];
}

// 穿衣建议
function getDressingAdvice(temperature, weatherDesc) {
    const temp = parseInt(temperature);
    if (temp >= 28) return "👕 天气炎热，建议穿短袖、短裤等清凉夏季服装";
    else if (temp >= 24) return "👕 天气较热，建议穿短袖、薄长裤等夏季服装";
    else if (temp >= 18) return "👕 温度舒适，建议穿长袖、薄外套等春秋过渡装";
    else if (temp >= 12) return "🧥 天气较凉，建议穿夹克、薄毛衣等春秋服装";
    else if (temp >= 5) return "🧥 天气冷，建议穿棉衣、厚外套等冬季服装";
    else return "🧥 天气寒冷，建议穿羽绒服、厚棉衣等保暖服装";
}

// 带伞提醒
function getUmbrellaAdvice(weatherDesc) {
    if (weatherDesc.includes("雨") || weatherDesc.includes("雪")) return "🌂 明天有降水，记得带伞哦！";
    else if (weatherDesc.includes("阴") || weatherDesc.includes("云")) return "🌂 明天可能转阴，建议备伞以防万一";
    else return "☀️ 明天天气晴朗，无需带伞";
}

// 天行数据天气类型映射
function getTianapiWeatherType(skycon) {
    const typeMap = {
        "CLEAR_DAY": 9, "CLEAR_NIGHT": 9,
        "PARTLY_CLOUDY_DAY": 2, "PARTLY_CLOUDY_NIGHT": 2,
        "CLOUDY": 10, "LIGHT_RAIN": 3, "MODERATE_RAIN": 3,
        "HEAVY_RAIN": 3, "STORM_RAIN": 8, "LIGHT_SNOW": 4,
        "MODERATE_SNOW": 4, "HEAVY_SNOW": 4, "STORM_SNOW": 4,
        "FOG": 7, "WIND": 1, "HAZE": 7
    };
    return typeMap[skycon] || null;
}

// 错误处理
function handleError(title, message) {
    console.error(`❌ 错误: ${title} - ${message}`);
    $notification.post("❌ " + title, message, "");
    $done();
}