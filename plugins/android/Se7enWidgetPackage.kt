// Se7enWidgetPackage.kt
// ReactPackage that registers the Se7enWidgetModule with React Native.
// Add an instance of this class to the packages list in MainApplication.kt.

package com.se7en.gymtracker.widget

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

class Se7enWidgetPackage : ReactPackage {
    override fun createNativeModules(
        reactContext: ReactApplicationContext,
    ): List<NativeModule> = listOf(Se7enWidgetModule(reactContext))

    override fun createViewManagers(
        reactContext: ReactApplicationContext,
    ): List<ViewManager<*, *>> = emptyList()
}
