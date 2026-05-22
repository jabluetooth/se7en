// Se7enWidgetsBridge.m
// Objective-C bridge — exposes the Se7enWidgetsBridge Swift methods to React Native.
// This file must be compiled in the *main app target* (not the widget extension target).

#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(Se7enWidgets, NSObject)

RCT_EXTERN_METHOD(setWidgetData:(NSString *)json)
RCT_EXTERN_METHOD(reloadWidgets)
RCT_EXTERN_METHOD(startLiveActivity:(NSString *)json)
RCT_EXTERN_METHOD(updateLiveActivity:(NSString *)json)
RCT_EXTERN_METHOD(endLiveActivity)

@end
