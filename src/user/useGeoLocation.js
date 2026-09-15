// GPS 定位 hook：按需开启（用户手势触发），持续跟踪并给出精度与校园内位置描述。
//
// 隐私：坐标只在本机内存里使用，不写 localStorage、不上传；关闭页面即释放。
// 优先级：蓝牙信标（室内）> GPS（室外）> 手动选点，室内楼层仍以信标或手动为准。

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { describeLocation } from './geo.js'

const INITIAL = {
  status: 'idle',
  lat: null,
  lon: null,
  accuracy: null,
  at: null,
  error: '',
}

export default function useGeoLocation() {
  const [state, setState] = useState(INITIAL)
  const watchRef = useRef(null)
  const supported = typeof navigator !== 'undefined' && Boolean(navigator.geolocation)

  const stop = useCallback(() => {
    if (watchRef.current != null && typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchRef.current)
    }
    watchRef.current = null
    setState((current) => ({ ...current, status: 'idle' }))
  }, [])

  const start = useCallback(() => {
    if (!supported) {
      setState({ ...INITIAL, status: 'unsupported', error: '当前浏览器不支持定位，请用手机浏览器打开' })
      return
    }
    setState((current) => ({ ...current, status: 'requesting', error: '' }))
    watchRef.current = navigator.geolocation.watchPosition(
      (result) => {
        setState({
          status: 'active',
          lat: result.coords.latitude,
          lon: result.coords.longitude,
          accuracy: result.coords.accuracy,
          at: result.timestamp,
          error: '',
        })
      },
      (error) => {
        const denied = error?.code === 1
        setState({
          ...INITIAL,
          status: denied ? 'denied' : error?.code === 3 ? 'timeout' : 'unavailable',
          error: denied
            ? '定位权限被拒绝，可在浏览器权限设置中允许后重试'
            : error?.code === 3
              ? '定位超时，室内信号弱时会这样，可稍后重试'
              : '暂时拿不到定位，请检查系统定位服务是否开启',
        })
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 3000 },
    )
  }, [supported])

  useEffect(() => stop, [stop])

  // 位置描述：校园内/外、最近出口与楼栋（供状态行与 AR 视图使用）
  const location = useMemo(
    () => (state.lat != null && state.lon != null ? describeLocation(state.lat, state.lon) : null),
    [state.lat, state.lon],
  )

  return { ...state, supported, location, start, stop }
}
