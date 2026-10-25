import socialMediaService from '../services/socialMediaService.js';

describe('Social publishing truthfulness', () => {
  const cases = [
    ['nintendo', 'publishNintendo', ['Title', 'Description']],
    ['playstation', 'publishPlayStation', ['Title', 'Description']],
    ['xbox', 'publishXbox', ['Title', 'Description']],
    ['g2', 'publishG2Review', ['Product', 'Review', 5]],
    ['capterra', 'publishCapterraReview', ['Product', 'Review']],
    ['clutch', 'publishClutch', ['profile', 'Review']],
    ['wechat', 'publishWeChat', ['Message']],
    ['appsumo', 'publishAppSumo', ['Product', 'Description']],
    ['alibaba', 'publishAlibaba', ['Product', 'Description']],
    ['rakuten', 'publishRakuten', ['Product', 'Description']],
    ['samsung', 'publishSamsungGalaxy', ['Title', 'Description']],
    ['huawei', 'publishHuaweiAppGallery', ['Title', 'Description']],
    ['amazonappstore', 'publishAmazonAppstore', ['Title', 'Description']],
    ['yelp', 'publishYelp', ['business', 'Review']],
    ['tripadvisor', 'publishTripAdvisor', ['location', 'Review']],
    ['bbb', 'publishBBB', ['business', 'Review']],
    ['quora', 'publishQuora', ['Question', 'Answer']],
    ['indiehackers', 'publishIndieHackers', ['Title', 'Body']],
    ['spotify', 'publishSpotifyPodcast', ['Title', 'Description', 'https://example.com/audio.mp3']],
    ['applePodcasts', 'publishApplePodcast', ['Title', 'Description']],
    ['clubhouse', 'publishClubhouse', ['Title', 'Description']],
    ['onlyfans', 'publishOnlyFans', ['Title', 'Body']],
  ];

  test.each(cases)('%s never reports a fake successful publish', async (tokenKey, method, args) => {
    const previous = socialMediaService.tokens[tokenKey];
    socialMediaService.tokens[tokenKey] = 'configured-for-test';
    try {
      const result = await socialMediaService[method](...args);
      expect(result.success).toBe(false);
      expect(result.published).toBe(false);
      expect(result.blocked).toBe(true);
      expect(result.manualRequired).toBe(true);
      expect(result.postId).toBeUndefined();
    } finally {
      socialMediaService.tokens[tokenKey] = previous;
    }
  });
});
