#import <React/RCTBridgeModule.h>

/// Tells SceneDelegate to drop the launch cover that sits above the React root.
@interface GifteezSplash : NSObject <RCTBridgeModule>
@end

@implementation GifteezSplash

RCT_EXPORT_MODULE();

+ (BOOL)requiresMainQueueSetup
{
  return YES;
}

- (dispatch_queue_t)methodQueue
{
  return dispatch_get_main_queue();
}

RCT_EXPORT_METHOD(hide)
{
  [[NSNotificationCenter defaultCenter] postNotificationName:@"GifteezSplashHide" object:nil];
}

@end
