class YouTubeAPIManager {
  constructor() {
    this.accessToken = null;
    this.API_KEY = 'REPLACE_WITH_API_KEY';
    this.BASE_URL = "https://www.googleapis.com/youtube/v3";
    this.init();
  }

  // STEP 2: Set up message listeners
  init() {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      console.log("Background received:", request.action);

      switch (request.action) {
        case "authenticate":
          this.authenticate()
            .then((result) => sendResponse(result))
            .catch((error) =>
              sendResponse({ success: false, error: error.message })
            );
          return true; // Keep message channel open

        case "checkAuthStatus":
          this.checkAuthStatus()
            .then((result) => sendResponse(result))
            .catch((error) =>
              sendResponse({ success: false, error: error.message })
            );
          return true;

        case "createPlaylist":
          this.createPlaylistFromInterests(
            request.interests,
            request.preferences
          )
            .then((result) => sendResponse(result))
            .catch((error) =>
              sendResponse({ success: false, error: error.message })
            );
          return true;

        case "saveUserPreferences":
          this.saveUserPreferences(request.preferences)
            .then((result) => sendResponse(result))
            .catch((error) =>
              sendResponse({ success: false, error: error.message })
            );
          return true;

        case "getUserPreferences":
          this.getUserPreferences()
            .then((result) => sendResponse(result))
            .catch((error) =>
              sendResponse({ success: false, error: error.message })
            );
          return true;

        case "revokeAuth":
          this.revokeAuthentication()
            .then((result) => sendResponse(result))
            .catch((error) =>
              sendResponse({ success: false, error: error.message })
            );
          return true;
      }
    });
  }

  // STEP 3: Handle OAuth Authentication
  async authenticate() {
    try {
      console.log("Starting OAuth authentication...");

      // Clear any cached tokens first
      await chrome.identity.clearAllCachedAuthTokens();

      // Get OAuth token from Chrome Identity API
      const result = await new Promise((resolve, reject) => {
        chrome.identity.getAuthToken(
          {
            interactive: true,
            scopes: [
              "https://www.googleapis.com/auth/youtube",
              "https://www.googleapis.com/auth/youtube.force-ssl",
            ],
          },
          (token) => {
            if (chrome.runtime.lastError) {
              console.error(
                "Chrome Identity API error:",
                chrome.runtime.lastError
              );
              reject(new Error(chrome.runtime.lastError.message));
            } else {
              resolve(token);
            }
          }
        );
      });

      // Check if token is valid and is a string
      if (!result || typeof result !== "string") {
        console.error("Invalid token received:", typeof result, result);
        throw new Error("No valid token received from authentication");
      }

      const token = result;

      console.log("Token received, length:", token.length);
      console.log("Token starts with:", token.substring(0, 20) + "...");
      this.accessToken = token;

      // Test the token by making a simple API call
      try {
        console.log("Testing token with API call...");
        const testUrl = `${this.BASE_URL}/channels?part=snippet&mine=true`;
        console.log("Test URL:", testUrl);

        const testResponse = await fetch(testUrl, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        });

        console.log("Test response status:", testResponse.status);
        console.log("Test response headers:", [
          ...testResponse.headers.entries(),
        ]);

        if (!testResponse.ok) {
          const errorText = await testResponse.text();
          console.error("Token validation failed - Response text:", errorText);

          let errorData;
          try {
            errorData = JSON.parse(errorText);
            console.error(
              "Token validation failed - Parsed error:",
              JSON.stringify(errorData, null, 2)
            );
          } catch (parseError) {
            console.error("Could not parse error response:", parseError);
            errorData = { error: { message: errorText } };
          }

          throw new Error(
            `Token validation failed: ${
              errorData.error?.message || errorText || "Unknown error"
            }`
          );
        }

        const responseData = await testResponse.json();
        console.log("Token validated successfully, user info:", responseData);
      } catch (testError) {
        console.error("Token test failed:", testError);
        throw new Error(
          `Authentication token is invalid: ${testError.message}`
        );
      }

      // Store token for future use
      await chrome.storage.local.set({
        youtubeAccessToken: token,
        authTimestamp: Date.now(),
      });

      console.log("Authentication successful");
      return {
        success: true,
        message: "Successfully connected to YouTube!",
        token: token,
      };
    } catch (error) {
      console.error("Authentication failed:", error);
      this.accessToken = null;

      // Clear any stored tokens on auth failure
      await chrome.storage.local.remove([
        "youtubeAccessToken",
        "authTimestamp",
      ]);

      return {
        success: false,
        error: `Authentication failed: ${error.message}`,
      };
    }
  }

  // Check authentication status
  async checkAuthStatus() {
    try {
      // Check if token exists in storage
      const result = await chrome.storage.local.get([
        "youtubeAccessToken",
        "authTimestamp",
      ]);

      if (
        result.youtubeAccessToken &&
        typeof result.youtubeAccessToken === "string"
      ) {
        this.accessToken = result.youtubeAccessToken;

        // Test if the token is still valid by making a simple API call
        try {
          const testResponse = await fetch(
            `${this.BASE_URL}/channels?part=snippet&mine=true`,
            {
              headers: {
                Authorization: `Bearer ${this.accessToken}`,
                "Content-Type": "application/json",
              },
            }
          );

          if (testResponse.ok) {
            return {
              authenticated: true,
              message: "Connected to YouTube",
            };
          } else {
            // Token is invalid, clear it
            await chrome.storage.local.remove([
              "youtubeAccessToken",
              "authTimestamp",
            ]);
            this.accessToken = null;
            return {
              authenticated: false,
              message: "Authentication expired. Please reconnect.",
            };
          }
        } catch (testError) {
          console.error("Token validation failed:", testError);
          await chrome.storage.local.remove([
            "youtubeAccessToken",
            "authTimestamp",
          ]);
          this.accessToken = null;
          return {
            authenticated: false,
            message: "Authentication expired. Please reconnect.",
          };
        }
      } else {
        return {
          authenticated: false,
          message: "Not connected to YouTube",
        };
      }
    } catch (error) {
      console.error("Auth status check failed:", error);
      return {
        authenticated: false,
        error: error.message,
      };
    }
  }

  // Save user preferences for video filtering
  async saveUserPreferences(preferences) {
    try {
      const defaultPreferences = {
        videoDuration: {
          min: 0, // seconds
          max: 3600, // 1 hour
          preferred: "medium", // 'short' (< 4 min), 'medium' (4-20 min), 'long' (> 20 min)
        },
        favoriteChannels: [], // Array of channel IDs or names
        audioLanguage: "en", // ISO language code
        videoQuality: {
          minViews: 1000,
          minLikes: 10,
          minSubscribers: 1000,
          maxAge: 365, // days
        },
        contentType: "any", // 'educational', 'entertainment', 'music', 'gaming', 'any'
        excludeKeywords: [], // Keywords to avoid
        includeKeywords: [], // Keywords to prioritize
      };

      const mergedPreferences = { ...defaultPreferences, ...preferences };

      await chrome.storage.local.set({ userPreferences: mergedPreferences });

      console.log("User preferences saved:", mergedPreferences);

      return {
        success: true,
        message: "Preferences saved successfully",
        preferences: mergedPreferences,
      };
    } catch (error) {
      console.error("Save preferences failed:", error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  // Get user preferences
  async getUserPreferences() {
    try {
      const result = await chrome.storage.local.get(["userPreferences"]);

      if (result.userPreferences) {
        return {
          success: true,
          preferences: result.userPreferences,
        };
      } else {
        // Return default preferences if none saved
        const defaultPreferences = {
          videoDuration: {
            min: 0,
            max: 3600,
            preferred: "medium",
          },
          favoriteChannels: [],
          audioLanguage: "en",
          videoQuality: {
            minViews: 1000,
            minLikes: 10,
            minSubscribers: 1000,
            maxAge: 365,
          },
          contentType: "any",
          excludeKeywords: [],
          includeKeywords: [],
        };

        return {
          success: true,
          preferences: defaultPreferences,
        };
      }
    } catch (error) {
      console.error("Get preferences failed:", error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  // Enhanced video filtering algorithm
  async filterAndScoreVideos(videos, preferences, interest) {
    const scoredVideos = [];

    for (const video of videos) {
      try {
        // Get detailed video information
        const videoDetails = await this.getVideoDetails(video.id.videoId);
        const channelDetails = await this.getChannelDetails(
          video.snippet.channelId
        );

        const score = this.calculateVideoScore(
          video,
          videoDetails,
          channelDetails,
          preferences,
          interest
        );

        if (score > 0) {
          // Only include videos with positive scores
          scoredVideos.push({
            ...video,
            details: videoDetails,
            channelDetails: channelDetails,
            score: score,
          });
        }
      } catch (error) {
        console.error(
          `Failed to get details for video ${video.id.videoId}:`,
          error
        );
        // Include video with basic score if details fetch fails
        const basicScore = this.calculateBasicScore(
          video,
          preferences,
          interest
        );
        if (basicScore > 0) {
          scoredVideos.push({
            ...video,
            score: basicScore,
          });
        }
      }
    }

    // Sort by score (highest first)
    return scoredVideos.sort((a, b) => b.score - a.score);
  }

  // Calculate comprehensive video score
  calculateVideoScore(
    video,
    videoDetails,
    channelDetails,
    preferences,
    interest
  ) {
    let score = 0;
    const maxScore = 100;

    // 1. Duration score (20 points max)
    if (videoDetails && videoDetails.contentDetails) {
      const duration = this.parseDuration(videoDetails.contentDetails.duration);
      score +=
        this.calculateDurationScore(duration, preferences.videoDuration) * 0.2;
    }

    // 2. Channel preference score (15 points max)
    if (
      preferences.favoriteChannels &&
      preferences.favoriteChannels.length > 0
    ) {
      const channelScore = this.calculateChannelScore(
        video.snippet.channelTitle,
        video.snippet.channelId,
        preferences.favoriteChannels
      );
      score += channelScore * 0.15;
    }

    // 3. Video quality score (25 points max)
    if (videoDetails && channelDetails) {
      const qualityScore = this.calculateQualityScore(
        videoDetails,
        channelDetails,
        preferences.videoQuality
      );
      score += qualityScore * 0.25;
    }

    // 4. Language score (10 points max)
    if (videoDetails && videoDetails.snippet) {
      const languageScore = this.calculateLanguageScore(
        videoDetails.snippet.defaultAudioLanguage,
        preferences.audioLanguage
      );
      score += languageScore * 0.1;
    }

    // 5. Content relevance score (20 points max)
    const relevanceScore = this.calculateRelevanceScore(
      video,
      interest,
      preferences
    );
    score += relevanceScore * 0.2;

    // 6. Freshness score (10 points max)
    const freshnessScore = this.calculateFreshnessScore(
      video.snippet.publishedAt,
      preferences.videoQuality.maxAge
    );
    score += freshnessScore * 0.1;

    return Math.min(score, maxScore);
  }

  // Calculate basic score when detailed info is unavailable
  calculateBasicScore(video, preferences, interest) {
    let score = 0;

    // Channel preference
    if (
      preferences.favoriteChannels &&
      preferences.favoriteChannels.length > 0
    ) {
      score +=
        this.calculateChannelScore(
          video.snippet.channelTitle,
          video.snippet.channelId,
          preferences.favoriteChannels
        ) * 0.3;
    }

    // Content relevance
    score += this.calculateRelevanceScore(video, interest, preferences) * 0.5;

    // Freshness
    score +=
      this.calculateFreshnessScore(
        video.snippet.publishedAt,
        preferences.videoQuality.maxAge
      ) * 0.2;

    return score;
  }

  // Individual scoring functions
  calculateDurationScore(duration, preferences) {
    if (!duration) return 0;

    const { min, max, preferred } = preferences;

    // Check if within acceptable range
    if (duration < min || duration > max) return 0;

    // Score based on preferred length
    let optimalRange;
    switch (preferred) {
      case "short":
        optimalRange = [0, 240]; // 0-4 minutes
        break;
      case "medium":
        optimalRange = [240, 1200]; // 4-20 minutes
        break;
      case "long":
        optimalRange = [1200, 3600]; // 20-60 minutes
        break;
      default:
        return 50; // Neutral score
    }

    if (duration >= optimalRange[0] && duration <= optimalRange[1]) {
      return 100;
    }

    // Gradual decrease for videos outside optimal range
    const distance = Math.min(
      Math.abs(duration - optimalRange[0]),
      Math.abs(duration - optimalRange[1])
    );

    return Math.max(0, 100 - distance / 60); // Decrease by 1 point per minute distance
  }

  calculateChannelScore(channelTitle, channelId, favoriteChannels) {
    for (const favorite of favoriteChannels) {
      if (
        channelId === favorite ||
        channelTitle.toLowerCase().includes(favorite.toLowerCase())
      ) {
        return 100;
      }
    }
    return 0;
  }

  calculateQualityScore(videoDetails, channelDetails, qualityPrefs) {
    let score = 0;

    // View count (25 points)
    const views = parseInt(videoDetails.statistics?.viewCount || 0);
    if (views >= qualityPrefs.minViews) {
      score += Math.min(25, Math.log10(views / qualityPrefs.minViews) * 10);
    }

    // Like ratio (25 points)
    const likes = parseInt(videoDetails.statistics?.likeCount || 0);
    const dislikes = parseInt(videoDetails.statistics?.dislikeCount || 0);
    if (likes >= qualityPrefs.minLikes) {
      const likeRatio = dislikes > 0 ? likes / (likes + dislikes) : 1;
      score += likeRatio * 25;
    }

    // Channel subscriber count (25 points)
    const subscribers = parseInt(
      channelDetails.statistics?.subscriberCount || 0
    );
    if (subscribers >= qualityPrefs.minSubscribers) {
      score += Math.min(
        25,
        Math.log10(subscribers / qualityPrefs.minSubscribers) * 10
      );
    }

    // Engagement rate (25 points)
    const comments = parseInt(videoDetails.statistics?.commentCount || 0);
    if (views > 0) {
      const engagementRate = (likes + comments) / views;
      score += Math.min(25, engagementRate * 1000); // Scale engagement rate
    }

    return score;
  }

  calculateLanguageScore(videoLanguage, preferredLanguage) {
    if (!videoLanguage) return 50; // Neutral if language unknown

    if (videoLanguage === preferredLanguage) {
      return 100;
    }

    // Partial score for similar languages (e.g., en-US vs en-GB)
    if (
      videoLanguage.startsWith(preferredLanguage) ||
      preferredLanguage.startsWith(videoLanguage)
    ) {
      return 75;
    }

    return 0;
  }

  calculateRelevanceScore(video, interest, preferences) {
    let score = 0;
    const title = video.snippet.title.toLowerCase();
    const description = video.snippet.description.toLowerCase();
    const interestLower = interest.toLowerCase();

    // Interest keyword match (40 points)
    if (title.includes(interestLower)) {
      score += 40;
    } else if (description.includes(interestLower)) {
      score += 20;
    }

    // Include keywords bonus (30 points)
    for (const keyword of preferences.includeKeywords || []) {
      if (
        title.includes(keyword.toLowerCase()) ||
        description.includes(keyword.toLowerCase())
      ) {
        score += 30 / preferences.includeKeywords.length;
      }
    }

    // Exclude keywords penalty
    for (const keyword of preferences.excludeKeywords || []) {
      if (
        title.includes(keyword.toLowerCase()) ||
        description.includes(keyword.toLowerCase())
      ) {
        return 0; // Completely exclude this video
      }
    }

    // Title quality (30 points) - prefer descriptive titles
    if (title.length > 10 && title.length < 100) {
      score += 15;
    }
    if (!title.includes("!!!") && !title.includes("???")) {
      score += 15; // Avoid clickbait indicators
    }

    return score;
  }

  calculateFreshnessScore(publishedAt, maxAgeDays) {
    const publishDate = new Date(publishedAt);
    const now = new Date();
    const ageDays = (now - publishDate) / (1000 * 60 * 60 * 24);

    if (ageDays > maxAgeDays) {
      return 0;
    }

    // Newer videos get higher scores
    return Math.max(0, 100 - (ageDays / maxAgeDays) * 100);
  }

  // Helper function to parse YouTube duration format (PT1H2M3S)
  parseDuration(duration) {
    const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!match) return 0;

    const hours = parseInt(match[1] || 0);
    const minutes = parseInt(match[2] || 0);
    const seconds = parseInt(match[3] || 0);

    return hours * 3600 + minutes * 60 + seconds;
  }

  // Get detailed video information
  async getVideoDetails(videoId) {
    try {
      const url = `${this.BASE_URL}/videos?part=snippet,contentDetails,statistics&id=${videoId}&key=${this.API_KEY}`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Failed to get video details: ${response.status}`);
      }

      const data = await response.json();
      return data.items[0];
    } catch (error) {
      console.error("Get video details error:", error);
      throw error;
    }
  }

  // Get channel details
  async getChannelDetails(channelId) {
    try {
      const url = `${this.BASE_URL}/channels?part=snippet,statistics&id=${channelId}&key=${this.API_KEY}`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Failed to get channel details: ${response.status}`);
      }

      const data = await response.json();
      return data.items[0];
    } catch (error) {
      console.error("Get channel details error:", error);
      throw error;
    }
  }

  // Enhanced create playlist from interests with filtering
  async createPlaylistFromInterests(interests, customPreferences = null) {
    try {
      // Ensure we have a valid token
      if (!this.accessToken) {
        const result = await chrome.storage.local.get(["youtubeAccessToken"]);
        if (
          result.youtubeAccessToken &&
          typeof result.youtubeAccessToken === "string"
        ) {
          this.accessToken = result.youtubeAccessToken;
        } else {
          throw new Error(
            "Not authenticated. Please connect to YouTube first."
          );
        }
      }

      if (!interests || interests.length === 0) {
        throw new Error("No interests provided");
      }

      // Get user preferences
      const preferencesResult = await this.getUserPreferences();
      if (!preferencesResult.success) {
        throw new Error("Failed to get user preferences");
      }

      const preferences = customPreferences || preferencesResult.preferences;

      console.log("Creating playlist with preferences:", preferences);

      // Create the playlist
      const playlistTitle = `Smart Playlist - ${new Date().toLocaleDateString()}`;
      const playlistDescription = `An AI-curated playlist based on your interests: ${interests.join(
        ", "
      )} and personal preferences.`;

      const playlistResult = await this.createPlaylist(
        playlistTitle,
        playlistDescription
      );

      if (!playlistResult.success) {
        if (
          playlistResult.error.includes("authentication") ||
          playlistResult.error.includes("credentials")
        ) {
          console.log("Auth failed, clearing token and requesting re-auth");
          await chrome.storage.local.remove([
            "youtubeAccessToken",
            "authTimestamp",
          ]);
          this.accessToken = null;
          throw new Error(
            "Authentication expired. Please reconnect to YouTube and try again."
          );
        }
        throw new Error(playlistResult.error);
      }

      const playlistId = playlistResult.id;
      console.log("Playlist created successfully:", playlistId);

      // Search and filter videos for each interest
      let totalVideosAdded = 0;
      const maxVideosPerInterest = 10; // Search more videos to have better filtering options
      const maxFinalVideosPerInterest = 3; // Final count after filtering

      for (const interest of interests) {
        try {
          console.log(`Searching for videos for interest: ${interest}`);

          // Search for more videos initially
          const rawVideos = await this.searchVideos(
            interest,
            maxVideosPerInterest
          );
          console.log(`Found ${rawVideos.length} raw videos for ${interest}`);

          // Filter and score videos
          const filteredVideos = await this.filterAndScoreVideos(
            rawVideos,
            preferences,
            interest
          );
          console.log(
            `Filtered to ${filteredVideos.length} quality videos for ${interest}`
          );

          // Take top videos based on score
          const topVideos = filteredVideos.slice(0, maxFinalVideosPerInterest);

          for (const video of topVideos) {
            try {
              await this.addVideoToPlaylist(playlistId, video.id.videoId);
              totalVideosAdded++;
              console.log(
                `Added video: ${
                  video.snippet.title
                } (Score: ${video.score?.toFixed(2)})`
              );

              // Add delay to avoid rate limiting
              await new Promise((resolve) => setTimeout(resolve, 300));
            } catch (videoError) {
              console.error(
                `Failed to add video ${video.snippet.title}:`,
                videoError
              );
            }
          }
        } catch (searchError) {
          console.error(
            `Failed to search for interest "${interest}":`,
            searchError
          );
        }
      }

      const playlistUrl = `https://www.youtube.com/playlist?list=${playlistId}`;

      return {
        success: true,
        playlistId: playlistId,
        playlistUrl: playlistUrl,
        videosAdded: totalVideosAdded,
        totalInterests: interests.length,
        message: `Successfully created smart playlist with ${totalVideosAdded} carefully selected videos!`,
        preferences: preferences,
      };
    } catch (error) {
      console.error("Create smart playlist failed:", error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  // STEP 7: Create a YouTube playlist
  async createPlaylist(title, description) {
    try {
      const response = await fetch(
        `${this.BASE_URL}/playlists?part=snippet,status`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            snippet: {
              title: title,
              description: description,
            },
            status: {
              privacyStatus: "private", // Can be 'private', 'public', or 'unlisted'
            },
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          `Failed to create playlist: ${
            errorData.error?.message || "Unknown error"
          }`
        );
      }

      const data = await response.json();
      return {
        success: true,
        id: data.id,
        title: data.snippet.title,
      };
    } catch (error) {
      console.error("Create playlist error:", error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  // STEP 8: Search for videos based on keyword
  async searchVideos(query, maxResults = 10) {
    try {
      const url =
        `${this.BASE_URL}/search?` +
        `part=snippet&type=video&q=${encodeURIComponent(query)}&` +
        `maxResults=${maxResults}&order=relevance&key=${this.API_KEY}`;

      const response = await fetch(url);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          `Search failed: ${errorData.error?.message || response.status}`
        );
      }

      const data = await response.json();
      return data.items || [];
    } catch (error) {
      console.error("Video search error:", error);
      throw error;
    }
  }

  // STEP 9: Add video to playlist
  async addVideoToPlaylist(playlistId, videoId) {
    try {
      const response = await fetch(
        `${this.BASE_URL}/playlistItems?part=snippet`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            snippet: {
              playlistId: playlistId,
              resourceId: {
                kind: "youtube#video",
                videoId: videoId,
              },
            },
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          `Failed to add video: ${errorData.error?.message || "Unknown error"}`
        );
      }

      return await response.json();
    } catch (error) {
      console.error("Add video error:", error);
      throw error;
    }
  }

  // STEP 10: Revoke authentication
  async revokeAuthentication() {
    try {
      if (this.accessToken && typeof this.accessToken === "string") {
        await chrome.identity.removeCachedAuthToken({
          token: this.accessToken,
        });
      }

      await chrome.storage.local.remove([
        "youtubeAccessToken",
        "authTimestamp",
      ]);
      this.accessToken = null;

      return {
        success: true,
        message: "Successfully disconnected from YouTube",
      };
    } catch (error) {
      console.error("Revoke auth error:", error);
      return {
        success: false,
        error: "Failed to disconnect",
      };
    }
  }
}

// STEP 11: Initialize the manager
const youtubeManager = new YouTubeAPIManager();
