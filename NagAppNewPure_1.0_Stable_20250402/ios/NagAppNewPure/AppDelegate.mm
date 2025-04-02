#import "AppDelegate.h"

#import <React/RCTBundleURLProvider.h>
#import <AVFoundation/AVFoundation.h>

@implementation AppDelegate

- (BOOL)application:(UIApplication *)application didFinishLaunchingWithOptions:(NSDictionary *)launchOptions
{
  self.moduleName = @"NagAppNewPure";
  // You can add your custom initial props in the dictionary below.
  // They will be passed down to the ViewController used by React Native.
  self.initialProps = @{};

  // Configure audio session
  NSError *error = nil;
  [[AVAudioSession sharedInstance] setCategory:AVAudioSessionCategoryPlayAndRecord
                                       mode:AVAudioSessionModeDefault
                                    options:AVAudioSessionCategoryOptionAllowBluetooth | AVAudioSessionCategoryOptionDefaultToSpeaker
                                      error:&error];
  if (error) {
    NSLog(@"Error setting audio session category: %@", error);
  }
  
  error = nil;
  [[AVAudioSession sharedInstance] setActive:YES error:&error];
  if (error) {
    NSLog(@"Error activating audio session: %@", error);
  }

  // Enable the new architecture
  self.bridge = [[RCTBridge alloc] initWithDelegate:self launchOptions:launchOptions];
  self.window = [[UIWindow alloc] initWithFrame:[UIScreen mainScreen].bounds];
  self.window.backgroundColor = [UIColor whiteColor];
  self.window.rootViewController = [[RCTRootView alloc] initWithBridge:self.bridge
                                                           moduleName:self.moduleName
                                                    initialProperties:self.initialProps];
  [self.window makeKeyAndVisible];
  return YES;
}

- (NSURL *)sourceURLForBridge:(RCTBridge *)bridge
{
#if DEBUG
  return [[RCTBundleURLProvider sharedSettings] jsBundleURLForBundleRoot:@"index"];
#else
  return [[NSBundle mainBundle] URLForResource:@"main" withExtension:@"jsbundle"];
#endif
}

/// This method controls whether the `concurrentRoot`feature of React18 is turned on or off.
///
/// @see: https://reactjs.org/blog/2022/03/29/react-v18.html
/// @note: This requires to be rendering on Fabric (i.e. on the New Architecture).
/// @return: `true` if the `concurrentRoot` feature is enabled. Otherwise, it returns `false`.
- (BOOL)concurrentRootEnabled
{
  return true;
}

@end 