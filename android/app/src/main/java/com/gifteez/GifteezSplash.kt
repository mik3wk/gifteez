package com.gifteez

import android.app.Activity
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.widget.FrameLayout
import android.widget.ImageView
import com.facebook.react.BaseReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.UiThreadUtil
import com.facebook.react.module.model.ReactModuleInfo
import com.facebook.react.module.model.ReactModuleInfoProvider

/** Full-window splash matching splash_screen.xml, removed once JS has drawn the loader. */
object GifteezSplash {
  private var view: View? = null

  fun show(activity: Activity) {
    if (view != null) {
      return
    }
    val decor = activity.window?.decorView as? ViewGroup ?: return
    val splash = FrameLayout(activity)
    splash.setBackgroundColor(activity.getColor(R.color.splash_background))
    splash.isClickable = true
    val image = ImageView(activity)
    image.setImageResource(R.drawable.splash_logo)
    image.scaleType = ImageView.ScaleType.FIT_CENTER
    val size = (240 * activity.resources.displayMetrics.density).toInt()
    splash.addView(image, FrameLayout.LayoutParams(size, size, Gravity.CENTER))
    decor.addView(
      splash,
      ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT),
    )
    view = splash
  }

  fun hide() {
    val splash = view ?: return
    view = null
    (splash.parent as? ViewGroup)?.removeView(splash)
  }
}

class GifteezSplashModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {
  override fun getName(): String = NAME

  @ReactMethod
  fun hide() {
    UiThreadUtil.runOnUiThread { GifteezSplash.hide() }
  }

  companion object {
    const val NAME = "GifteezSplash"
  }
}

class GifteezSplashPackage : BaseReactPackage() {
  override fun getModule(name: String, reactContext: ReactApplicationContext): NativeModule? {
    if (name == GifteezSplashModule.NAME) {
      return GifteezSplashModule(reactContext)
    }
    return null
  }

  override fun getReactModuleInfoProvider(): ReactModuleInfoProvider {
    return ReactModuleInfoProvider {
      mapOf(
        GifteezSplashModule.NAME to ReactModuleInfo(
          GifteezSplashModule.NAME,
          GifteezSplashModule::class.java.name,
          false,
          false,
          false,
          false,
        ),
      )
    }
  }
}
