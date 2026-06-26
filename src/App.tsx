import { Suspense, lazy, useEffect, useState } from 'react'

import { TitleBar } from './components/TitleBar/TitleBar'
import { SystemThemeProvider } from './context/SystemThemeContext'
import { KeychainAttachmentsProvider } from './features/launcher/hooks/useKeychainAttachments'
import { isOnboardingRequired } from './features/onboarding/storage'
import { markBootStage } from './utils/bootPerf'

const LauncherRoot = lazy(() => import('./features/launcher/LauncherRoot'))
const OnboardingFlow = lazy(() => import('./features/onboarding/OnboardingFlowLazy'))

const appInnerFallback = <div aria-hidden="true" />

function WaterRippleFilterDefs() {
  return (
    <svg width="0" height="0" aria-hidden="true" focusable="false" style={{ position: 'absolute' }}>
      <defs>
        <filter id="tm-water-ripple-filter" x="-60%" y="-60%" width="220%" height="220%" colorInterpolationFilters="sRGB">
          {/* Broad undulation */}
          <feTurbulence type="turbulence" baseFrequency="0.015 0.013" numOctaves="4" seed="3" stitchTiles="stitch" result="rippleNoiseBroad">
          </feTurbulence>

          {/* Fine ripples layered over the broad swell */}
          <feTurbulence type="fractalNoise" baseFrequency="0.048 0.042" numOctaves="2" seed="11" stitchTiles="stitch" result="rippleNoiseFine">
          </feTurbulence>

          {/* Strong first warp pass */}
          <feDisplacementMap in="SourceGraphic" in2="rippleNoiseBroad" scale="30" xChannelSelector="R" yChannelSelector="G" result="warpedBroad">
            <animate attributeName="scale" values="24;33;28;37;25;24" dur="32s" repeatCount="indefinite" />
          </feDisplacementMap>

          {/* Secondary finer warp pass so motion reads as ripples, not blur */}
          <feDisplacementMap in="warpedBroad" in2="rippleNoiseFine" scale="10" xChannelSelector="G" yChannelSelector="B" result="warped">
            <animate attributeName="scale" values="6;11;8;12;7;6" dur="26s" repeatCount="indefinite" />
          </feDisplacementMap>

          {/* Clip displaced result before colorization so edge spikes cannot get amplified */}
          <feComposite in="warped" in2="SourceAlpha" operator="in" result="warpedClipped" />

          {/* Deformation-only finish: preserve CSS-controlled orange/green palette, increase dark/light contrast. */}
          <feComponentTransfer in="warpedClipped" result="watered">
            <feFuncR type="gamma" amplitude="1" exponent="0.9" offset="0" />
            <feFuncG type="gamma" amplitude="1" exponent="0.92" offset="0" />
            <feFuncB type="linear" slope="0" intercept="0" />
            <feFuncA type="linear" slope="1" intercept="0" />
          </feComponentTransfer>

          {/* Keep output natural and clipped to sticker alpha */}
          <feColorMatrix in="watered" type="saturate" values="1.65" result="finalRipple" />
          <feComposite in="finalRipple" in2="SourceAlpha" operator="in" result="rippleClipped" />
        </filter>

        {/*
          Lava Contour filter — smooth stripe warper.
          CSS provides contour bands, this filter bends them into organic loops.
          primitiveUnits="objectBoundingBox" keeps distortion behavior consistent
          across sticker sizes.
        */}
        <filter id="tm-lava-contour-filter"
          primitiveUnits="objectBoundingBox"
          x="-16%" y="-16%" width="132%" height="132%"
          colorInterpolationFilters="sRGB">

          {/*
            Low-frequency fractal turbulence drives a smooth displacement field.
            Only baseFrequency animates and loops back to the start value, so the
            motion stays fluid with no teleport/jitter at loop boundaries.
          */}
          <feTurbulence type="fractalNoise" baseFrequency="0.24 0.18" numOctaves="1" seed="7" stitchTiles="stitch" result="lavaWarpNoise">
            <animate
              attributeName="baseFrequency"
              values="0.24 0.18;0.18 0.28;0.32 0.14;0.22 0.24;0.24 0.18"
              dur="28s"
              repeatCount="indefinite"
              calcMode="spline"
              keyTimes="0;0.25;0.5;0.75;1"
              keySplines="0.45 0 0.55 1;0.45 0 0.55 1;0.45 0 0.55 1;0.45 0 0.55 1"
            />
          </feTurbulence>

          <feDisplacementMap
            in="SourceGraphic"
            in2="lavaWarpNoise"
            scale="0.055"
            xChannelSelector="R"
            yChannelSelector="G"
            result="lavaWarped"
          />

          <feComposite in="lavaWarped" in2="SourceAlpha" operator="in" />
        </filter>
      </defs>
    </svg>
  )
}

function BubbleOilSlickFilterDefs() {
  return (
    <svg width="0" height="0" aria-hidden="true" focusable="false" style={{ position: 'absolute' }}>
      <defs>
        <filter id="tm-bubble-oilslick-filter" x="-30%" y="-30%" width="160%" height="160%" colorInterpolationFilters="sRGB">
          <feTurbulence type="turbulence" baseFrequency="0.010 0.020" numOctaves="3" seed="9" stitchTiles="stitch" result="noise">
            <animate
              attributeName="baseFrequency"
              values="0.009 0.018;0.011 0.022;0.008 0.017;0.010 0.021;0.009 0.018"
              dur="61s"
              repeatCount="indefinite"
            />
          </feTurbulence>
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="8" xChannelSelector="R" yChannelSelector="B" result="displaced">
            <animate attributeName="scale" values="5.5;7.8;6.2;8.4;5.5" dur="73s" repeatCount="indefinite" />
          </feDisplacementMap>
          <feColorMatrix in="displaced" type="saturate" values="1.18" result="boosted" />
          <feColorMatrix in="boosted" type="hueRotate" values="0" result="hued">
            <animate attributeName="values" values="0;24;0" dur="24s" repeatCount="indefinite" />
          </feColorMatrix>
          <feComponentTransfer in="hued" result="oilslicked">
            <feFuncR type="gamma" amplitude="1" exponent="0.95" offset="0" />
            <feFuncG type="gamma" amplitude="1" exponent="0.93" offset="0" />
            <feFuncB type="gamma" amplitude="1" exponent="0.9" offset="0" />
          </feComponentTransfer>
        </filter>
      </defs>
    </svg>
  )
}

function App() {
  const [shouldShowOnboarding, setShouldShowOnboarding] = useState(() => isOnboardingRequired())

  useEffect(() => {
    markBootStage('app:mounted', { onboarding: shouldShowOnboarding })
  }, [shouldShowOnboarding])

  if (shouldShowOnboarding) {
    return (
      <SystemThemeProvider accentKey="all">
        <BubbleOilSlickFilterDefs />
        <WaterRippleFilterDefs />
        <TitleBar activeTab="launcher" controlsOnly showProfileAvatarImage={false} switchTab={() => {}} />
        <Suspense fallback={appInnerFallback}>
          <OnboardingFlow layoutMode="overlay" onCompleted={() => setShouldShowOnboarding(false)} />
        </Suspense>
      </SystemThemeProvider>
    )
  }

  return (
    <KeychainAttachmentsProvider>
      <BubbleOilSlickFilterDefs />
      <WaterRippleFilterDefs />
      <Suspense fallback={appInnerFallback}>
        <LauncherRoot />
      </Suspense>
    </KeychainAttachmentsProvider>
  )
}

export default App
