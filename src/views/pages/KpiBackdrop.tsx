
type Props = { v: any };

export default function KpiBackdrop({ v }: Props) {
  return (
    <>
      <div aria-hidden="true" style={{"position":"absolute","top":"12px","left":"18px","right":"18px","bottom":"0","borderRadius":"30px","overflow":"hidden","pointerEvents":"none","boxShadow":"inset 0 0 0 1px rgba(255,255,255,.06),0 24px 60px rgba(0,0,0,.35)"}}>
        <svg viewBox="0 0 1400 520" preserveAspectRatio="xMidYMid slice" width="100%" height="100%" style={{"position":"absolute","inset":"0","display":"block"}}>
          <defs>
            <linearGradient id="kbR1" x1="0" y1="1" x2="0" y2="0">
              <stop offset="0" style={{"stopColor":"color-mix(in oklab, var(--kb,#5f8f63) 62%, #050806)","stopOpacity":"1"}} />
              <stop offset="0.55" style={{"stopColor":"color-mix(in oklab, var(--kb,#5f8f63) 26%, #050806)","stopOpacity":"1"}} />
              <stop offset="1" style={{"stopColor":"color-mix(in oklab, var(--kb,#5f8f63) 10%, #050806)","stopOpacity":"1"}} />
            </linearGradient>
            <linearGradient id="kbR2" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" style={{"stopColor":"color-mix(in oklab, var(--kb,#5f8f63) 74%, #050806)","stopOpacity":"1"}} />
              <stop offset="0.35" style={{"stopColor":"color-mix(in oklab, var(--kb,#5f8f63) 36%, #050806)","stopOpacity":"1"}} />
              <stop offset="1" style={{"stopColor":"color-mix(in oklab, var(--kb,#5f8f63) 8%, #050806)","stopOpacity":"1"}} />
            </linearGradient>
            <linearGradient id="kbR3" x1="1" y1="0" x2="0" y2="1">
              <stop offset="0" style={{"stopColor":"color-mix(in oklab, var(--kb,#5f8f63) 80%, #050806)","stopOpacity":"1"}} />
              <stop offset="0.5" style={{"stopColor":"color-mix(in oklab, var(--kb,#5f8f63) 40%, #050806)","stopOpacity":"1"}} />
              <stop offset="1" style={{"stopColor":"color-mix(in oklab, var(--kb,#5f8f63) 12%, #050806)","stopOpacity":"1"}} />
            </linearGradient>
            <filter id="kbBloom" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="70" />
            </filter>
            <filter id="kbSoftShadow" x="-10%" y="-20%" width="120%" height="160%">
              <feGaussianBlur stdDeviation="26" />
            </filter>
            <filter id="kbEdge" x="-5%" y="-5%" width="110%" height="110%">
              <feGaussianBlur stdDeviation="1.6" />
            </filter>
            <filter id="kbSheen" x="-10%" y="-50%" width="120%" height="200%">
              <feGaussianBlur stdDeviation="7" />
            </filter>
            <filter id="kbGrain">
              <feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="2" stitchTiles="stitch" />
              <feColorMatrix values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 .5 0" />
            </filter>
            <radialGradient id="kbVig" cx=".45" cy=".5" r=".8">
              <stop offset=".5" stopColor="#000" stopOpacity="0" />
              <stop offset="1" stopColor="#000" stopOpacity=".5" />
            </radialGradient>
          </defs>
          <rect width="1400" height="520" style={{"fill":"color-mix(in oklab, var(--kb,#5f8f63) 8%, #050806)"}} />
          <g filter="url(#kbBloom)">
            <circle cx="170" cy="110" r="250" style={{"fill":"color-mix(in oklab, var(--kb,#5f8f63) 58%, #050806)"}} opacity=".85">
              <animateTransform attributeName="transform" type="translate" values="0 0;40 24;0 0" dur="34s" repeatCount="indefinite" calcMode="spline" keyTimes="0;.5;1" keySplines=".45 0 .55 1;.45 0 .55 1" />
            </circle>
            <circle cx="1260" cy="400" r="270" style={{"fill":"color-mix(in oklab, var(--kb,#5f8f63) 64%, #050806)"}} opacity=".8">
              <animateTransform attributeName="transform" type="translate" values="0 0;-36 -20;0 0" dur="28s" repeatCount="indefinite" calcMode="spline" keyTimes="0;.5;1" keySplines=".45 0 .55 1;.45 0 .55 1" />
            </circle>
            <circle cx="760" cy="560" r="230" style={{"fill":"color-mix(in oklab, var(--kb,#5f8f63) 42%, #050806)"}} opacity=".6">
              <animateTransform attributeName="transform" type="translate" values="0 0;24 -18;0 0" dur="38s" repeatCount="indefinite" calcMode="spline" keyTimes="0;.5;1" keySplines=".45 0 .55 1;.45 0 .55 1" />
            </circle>
          </g>
          <g>
            <animateTransform attributeName="transform" type="translate" values="0 0;26 10;0 0" dur="26s" repeatCount="indefinite" calcMode="spline" keyTimes="0;.5;1" keySplines=".45 0 .55 1;.45 0 .55 1" />
            <path d="M-120 118 C120 58 360 66 560 138 S960 262 1520 84 L1520 -40 H-120 Z" fill="#000" opacity=".5" filter="url(#kbSoftShadow)" transform="translate(0 18)" />
            <path d="M-120 118 C120 58 360 66 560 138 S960 262 1520 84 L1520 -40 H-120 Z" fill="url(#kbR1)" filter="url(#kbEdge)" />
            <path d="M-120 118 C120 58 360 66 560 138 S960 262 1520 84" fill="none" stroke="color-mix(in oklab, var(--kb,#5f8f63) 60%, #fff)" strokeOpacity=".32" strokeWidth="10" strokeLinecap="round" filter="url(#kbSheen)" />
          </g>
          <g>
            <animateTransform attributeName="transform" type="translate" values="0 0;-30 -12;0 0" dur="22s" repeatCount="indefinite" calcMode="spline" keyTimes="0;.5;1" keySplines=".45 0 .55 1;.45 0 .55 1" />
            <path d="M-120 330 C180 248 420 226 700 296 S1160 424 1520 290 L1520 432 C1180 548 920 440 700 424 S220 400 -120 478 Z" fill="#000" opacity=".5" filter="url(#kbSoftShadow)" transform="translate(0 18)" />
            <path d="M-120 330 C180 248 420 226 700 296 S1160 424 1520 290 L1520 432 C1180 548 920 440 700 424 S220 400 -120 478 Z" fill="url(#kbR2)" filter="url(#kbEdge)" />
            <path d="M-120 330 C180 248 420 226 700 296 S1160 424 1520 290" fill="none" stroke="color-mix(in oklab, var(--kb,#5f8f63) 60%, #fff)" strokeOpacity=".32" strokeWidth="10" strokeLinecap="round" filter="url(#kbSheen)" />
          </g>
          <g>
            <animateTransform attributeName="transform" type="translate" values="0 0;-18 14;0 0" dur="30s" repeatCount="indefinite" calcMode="spline" keyTimes="0;.5;1" keySplines=".45 0 .55 1;.45 0 .55 1" />
            <path d="M1520 150 C1310 164 1140 262 1090 404 C1052 512 1130 600 1260 640 H1520 Z" fill="#000" opacity=".5" filter="url(#kbSoftShadow)" transform="translate(0 18)" />
            <path d="M1520 150 C1310 164 1140 262 1090 404 C1052 512 1130 600 1260 640 H1520 Z" fill="url(#kbR3)" filter="url(#kbEdge)" />
            <path d="M1520 150 C1310 164 1140 262 1090 404 C1052 512 1130 600 1260 640" fill="none" stroke="color-mix(in oklab, var(--kb,#5f8f63) 60%, #fff)" strokeOpacity=".32" strokeWidth="10" strokeLinecap="round" filter="url(#kbSheen)" />
          </g>
          <rect width="1400" height="520" fill="url(#kbVig)" />
          <rect width="1400" height="520" filter="url(#kbGrain)" opacity=".05" />
        </svg>
      </div>
    </>
  );
}
