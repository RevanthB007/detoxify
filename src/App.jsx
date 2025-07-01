// import { useState, useEffect } from 'react';

// export default function App() {
//   const [interests, setInterests] = useState([]);
//   const [inputValue, setInputValue] = useState('');
//   const [isLoading, setIsLoading] = useState(true);
  
//   // New states for YouTube functionality
//   const [isAuthenticated, setIsAuthenticated] = useState(false);
//   const [isAuthenticating, setIsAuthenticating] = useState(false);
//   const [isCreatingPlaylist, setIsCreatingPlaylist] = useState(false);
//   const [playlistResult, setPlaylistResult] = useState(null);
//   const [authStatus, setAuthStatus] = useState('');

//   // Load interests and check auth status on component mount
//   useEffect(() => {
//     loadInterestsFromStorage();
//     checkYouTubeAuthStatus();
//   }, []);

//   // Load interests from storage
//   const loadInterestsFromStorage = async () => {
//     try {
//       const result = await chrome.storage.sync.get(['interests']);
//       const savedInterests = result.interests || [];
//       setInterests(savedInterests);
//       setIsLoading(false);
//     } catch (error) {
//       console.error('Error loading interests:', error);
//       setIsLoading(false);
//     }
//   };

//   // Save interests to Chrome storage
//   const saveInterestsToStorage = async (newInterests) => {
//     try {
//       await chrome.storage.sync.set({ interests: newInterests });
//       console.log('Interests saved to storage:', newInterests);
//     } catch (error) {
//       console.error('Error saving interests:', error);
//     }
//   };

//   // Check YouTube authentication status
//   const checkYouTubeAuthStatus = async () => {
//     try {
//       chrome.runtime.sendMessage({action: 'checkAuthStatus'}, (response) => {
//         if (chrome.runtime.lastError) {
//           console.error('Auth check failed:', chrome.runtime.lastError);
//           setIsAuthenticated(false);
//         } else {
//           setIsAuthenticated(response.authenticated || false);
//           if (response.message) {
//             setAuthStatus(response.message);
//           }
//         }
//       });
//     } catch (error) {
//       console.error('Error checking auth status:', error);
//       setIsAuthenticated(false);
//     }
//   };

//   // Authenticate with YouTube
//   const authenticateYouTube = async () => {
//     setIsAuthenticating(true);
//     setAuthStatus('Connecting to YouTube...');
    
//     try {
//       chrome.runtime.sendMessage({action: 'authenticate'}, (response) => {
//         setIsAuthenticating(false);
        
//         if (response.success) {
//           setIsAuthenticated(true);
//           setAuthStatus('Successfully connected to YouTube!');
//           setTimeout(() => setAuthStatus(''), 3000);
//         } else {
//           setIsAuthenticated(false);
//           setAuthStatus(`Failed to connect: ${response.error}`);
//           setTimeout(() => setAuthStatus(''), 5000);
//         }
//       });
//     } catch (error) {
//       setIsAuthenticating(false);
//       setAuthStatus('Authentication failed. Please try again.');
//       setTimeout(() => setAuthStatus(''), 5000);
//     }
//   };

//   // Create YouTube playlist from interests
//   const createYouTubePlaylist = async () => {
//     if (interests.length === 0) {
//       setAuthStatus('Please add some interests first!');
//       setTimeout(() => setAuthStatus(''), 3000);
//       return;
//     }

//     setIsCreatingPlaylist(true);
//     setAuthStatus('Creating your playlist...');
//     setPlaylistResult(null);

//     try {
//       chrome.runtime.sendMessage({
//         action: 'createPlaylist',
//         interests: interests
//       }, (response) => {
//         setIsCreatingPlaylist(false);
        
//         if (response.success) {
//           setPlaylistResult(response);
//           setAuthStatus(`Playlist created! Added ${response.videosAdded} videos.`);
//         } else {
//           setAuthStatus(`Failed to create playlist: ${response.error}`);
//         }
        
//         setTimeout(() => setAuthStatus(''), 5000);
//       });
//     } catch (error) {
//       setIsCreatingPlaylist(false);
//       setAuthStatus('Failed to create playlist. Please try again.');
//       setTimeout(() => setAuthStatus(''), 5000);
//     }
//   };

//   // Disconnect from YouTube
//   const disconnectYouTube = async () => {
//     try {
//       chrome.runtime.sendMessage({action: 'revokeAuth'}, (response) => {
//         if (response.success) {
//           setIsAuthenticated(false);
//           setPlaylistResult(null);
//           setAuthStatus('Disconnected from YouTube');
//           setTimeout(() => setAuthStatus(''), 3000);
//         }
//       });
//     } catch (error) {
//       console.error('Error disconnecting:', error);
//     }
//   };

//   const handleAdd = async () => {
//     if (inputValue.trim()) {
//       // Split by comma and clean up each interest
//       const newInterests = inputValue
//         .split(',')
//         .map(interest => interest.trim())
//         .filter(interest => interest.length > 0)
//         .filter(interest => !interests.includes(interest)); // Avoid duplicates
        
//       const updatedInterests = [...interests, ...newInterests];
//       setInterests(updatedInterests);
//       setInputValue('');
      
//       // Save to Chrome storage
//       await saveInterestsToStorage(updatedInterests); // Fixed: use updatedInterests

//       //notify the bg script to update the YouTube feed
//       await notifyContentScript(updatedInterests); // Fixed: use updatedInterests
//     }
//   };

//   const handleCancel = () => {
//     setInputValue('');
//   };

//   const handleDelete = async (interestToDelete) => {
//     const updatedInterests = interests.filter(interest => interest !== interestToDelete);
//     setInterests(updatedInterests);
    
//     // Save to Chrome storage
//     await saveInterestsToStorage(updatedInterests);

//     //notify the bg script to update the YouTube feed
//     await notifyContentScript(updatedInterests);
//   };

//   const handleKeyPress = (e) => {
//     if (e.key === 'Enter') {
//       handleAdd();
//     }
//   };

//   const notifyContentScript = async (interests) => {
//     try {
//       const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
//       console.log('Attempting to send message to tab:', tab.url);
      
//       if(tab.url?.includes('youtube.com')) {
//         chrome.tabs.sendMessage(tab.id, {
//           action: 'updateInterests',
//           interests: interests
//         }, (response) => {
//           if (chrome.runtime.lastError) {
//             console.error('Extension message failed:', chrome.runtime.lastError.message);
//           } else {
//             console.log('Extension message sent successfully:', response);
//           }
//         });
//       }
//       console.log('Background script notified to update interests:', interests);
//     } catch (error) {
//       console.error('Error notifying background script:', error);
//     }
//   }

//   const handleClearAll = async () => {
//     const confirmed = window.confirm('Are you sure you want to clear all interests? This will reset your YouTube feed.');
    
//     if (confirmed) {
//       setInterests([]);
//       // Save empty array to Chrome storage
//       await saveInterestsToStorage([]);
//       setPlaylistResult(null); // Clear playlist result too
//     }
//   };

//   if (isLoading) {
//     return (
//       <div className="w-80 p-4 bg-white">
//         <div className="text-center text-gray-500">Loading interests...</div>
//       </div>
//     );
//   }

//   return (
//     <div className="w-80 p-4 bg-white">
//       <h2 className="text-lg font-semibold mb-4 text-gray-800">Your Interests</h2>
      
//       {/* Input Section */}
//       <div className="mb-4">
//         <input
//           type="text"
//           value={inputValue}
//           onChange={(e) => setInputValue(e.target.value)}
//           onKeyPress={handleKeyPress}
//           placeholder="Enter interests (comma-separated)"
//           className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
//         />
        
//         <div className="flex gap-2 mt-2">
//           <button
//             onClick={handleAdd}
//             disabled={!inputValue.trim()}
//             className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
//           >
//             Add
//           </button>
//           <button
//             onClick={handleCancel}
//             className="px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 transition-colors"
//           >
//             Cancel
//           </button>
//         </div>
//       </div>

//       {/* Interests List */}
//       <div className="space-y-2">
//         {interests.length === 0 ? (
//           <p className="text-gray-500 text-sm italic">No interests added yet</p>
//         ) : (
//           interests.map((interest, index) => (
//             <div
//               key={index}
//               className="flex items-center justify-between bg-gray-100 px-3 py-2 rounded-md"
//             >
//               <span className="text-gray-800">{interest}</span>
//               <button
//                 onClick={() => handleDelete(interest)}
//                 className="text-red-500 hover:text-red-700 font-bold text-lg leading-none"
//                 title="Delete interest"
//               >
//                 ×
//               </button>
//             </div>
//           ))
//         )}
//       </div>

//       {/* Interest Count */}
//       {interests.length > 0 && (
//         <div className="mt-4 flex items-center justify-between">
//           <div className="text-sm text-gray-600">
//             {interests.length} interest{interests.length !== 1 ? 's' : ''} added
//           </div>
//           <button
//             onClick={handleClearAll}
//             className="px-3 py-1 text-sm bg-red-500 text-white rounded-md hover:bg-red-600 transition-colors"
//           >
//             Clear All
//           </button>
//         </div>
//       )}

//       {/* YouTube Playlist Section */}
//       <div className="mt-6 pt-4 border-t border-gray-200">
//         <h3 className="text-md font-semibold mb-3 text-gray-800 flex items-center">
//           🎵 YouTube Playlist
//         </h3>
        
//         {!isAuthenticated ? (
//           <div className="space-y-2">
//             <p className="text-sm text-gray-600">Connect to YouTube to create playlists from your interests</p>
//             <button
//               onClick={authenticateYouTube}
//               disabled={isAuthenticating}
//               className="w-full px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
//             >
//               {isAuthenticating ? (
//                 <>
//                   <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
//                   Connecting...
//                 </>
//               ) : (
//                 '🔗 Connect to YouTube'
//               )}
//             </button>
//           </div>
//         ) : (
//           <div className="space-y-2">
//             <p className="text-sm text-green-600 flex items-center">
//               ✅ Connected to YouTube
//             </p>
//             <div className="flex gap-2">
//               <button
//                 onClick={createYouTubePlaylist}
//                 disabled={isCreatingPlaylist || interests.length === 0}
//                 className="flex-1 px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
//               >
//                 {isCreatingPlaylist ? (
//                   <>
//                     <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
//                     Creating...
//                   </>
//                 ) : (
//                   '🎶 Create Playlist'
//                 )}
//               </button>
//               <button
//                 onClick={disconnectYouTube}
//                 className="px-3 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 transition-colors text-sm"
//               >
//                 Disconnect
//               </button>
//             </div>
//           </div>
//         )}

//         {/* Status Message */}
//         {authStatus && (
//           <div className={`mt-2 p-2 rounded-md text-sm ${
//             authStatus.includes('Success') || authStatus.includes('created') 
//               ? 'bg-green-100 text-green-700' 
//               : authStatus.includes('Failed') || authStatus.includes('Error')
//               ? 'bg-red-100 text-red-700'
//               : 'bg-blue-100 text-blue-700'
//           }`}>
//             {authStatus}
//           </div>
//         )}

//         {/* Playlist Result */}
//         {playlistResult && (
//           <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-md">
//             <div className="flex items-center justify-between mb-2">
//               <span className="text-sm font-medium text-green-800">
//                 Playlist Created! 🎉
//               </span>
//               <button
//                 onClick={() => setPlaylistResult(null)}
//                 className="text-green-600 hover:text-green-800 text-sm"
//               >
//                 ✕
//               </button>
//             </div>
//             <div className="text-sm text-green-700 space-y-1">
//               <div>📹 {playlistResult.videosAdded} videos added</div>
//               <div>🎯 {playlistResult.totalInterests} interests covered</div>
//               <a 
//                 href={playlistResult.playlistUrl} 
//                 target="_blank" 
//                 rel="noopener noreferrer"
//                 className="inline-block mt-2 px-3 py-1 bg-green-500 text-white rounded text-sm hover:bg-green-600 transition-colors"
//               >
//                 🔗 Open Playlist
//               </a>
//             </div>
//           </div>
//         )}
//       </div>
//     </div>
//   );
// }

import { useState, useEffect } from 'react';

export default function App() {
  const [interests, setInterests] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  
  // YouTube functionality states
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [isCreatingPlaylist, setIsCreatingPlaylist] = useState(false);
  const [playlistResult, setPlaylistResult] = useState(null);
  const [authStatus, setAuthStatus] = useState('');
  
  // New states for preferences
  const [showPreferences, setShowPreferences] = useState(false);
  const [preferences, setPreferences] = useState({
    videoDuration: {
      min: 0,
      max: 3600,
      preferred: 'medium'
    },
    favoriteChannels: [],
    audioLanguage: 'en',
    videoQuality: {
      minViews: 1000,
      minLikes: 10,
      minSubscribers: 1000,
      maxAge: 365
    },
    contentType: 'any',
    excludeKeywords: [],
    includeKeywords: []
  });

  // Load interests and check auth status on component mount
  useEffect(() => {
    loadInterestsFromStorage();
    checkYouTubeAuthStatus();
    loadUserPreferences();
  }, []);

  // Helper function to send messages to background script
  const sendMessage = (action, data = {}) => {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ action, ...data }, (response) => {
        if (chrome.runtime.lastError) {
          console.error('Message error:', chrome.runtime.lastError);
          resolve({ success: false, error: chrome.runtime.lastError.message });
        } else {
          resolve(response || { success: false, error: 'No response received' });
        }
      });
    });
  };

  // Load interests from storage
  const loadInterestsFromStorage = async () => {
    try {
      const result = await chrome.storage.sync.get(['interests']);
      const savedInterests = result.interests || [];
      setInterests(savedInterests);
      setIsLoading(false);
    } catch (error) {
      console.error('Error loading interests:', error);
      setIsLoading(false);
    }
  };

  // Save interests to Chrome storage
  const saveInterestsToStorage = async (newInterests) => {
    try {
      await chrome.storage.sync.set({ interests: newInterests });
      console.log('Interests saved to storage:', newInterests);
    } catch (error) {
      console.error('Error saving interests:', error);
    }
  };

  // Load user preferences from background script
  const loadUserPreferences = async () => {
    try {
      const result = await sendMessage('getUserPreferences');
      if (result.success && result.preferences) {
        setPreferences(result.preferences);
      }
    } catch (error) {
      console.error('Failed to load preferences:', error);
    }
  };

  // Save user preferences to background script
  const saveUserPreferences = async (newPreferences) => {
    try {
      const result = await sendMessage('saveUserPreferences', { preferences: newPreferences });
      if (result.success) {
        setPreferences(newPreferences);
        setAuthStatus('Preferences saved successfully!');
        setTimeout(() => setAuthStatus(''), 2000);
      } else {
        setAuthStatus('Failed to save preferences');
        setTimeout(() => setAuthStatus(''), 3000);
      }
    } catch (error) {
      console.error('Failed to save preferences:', error);
      setAuthStatus('Failed to save preferences');
      setTimeout(() => setAuthStatus(''), 3000);
    }
  };

  // Check YouTube authentication status
  const checkYouTubeAuthStatus = async () => {
    try {
      const response = await sendMessage('checkAuthStatus');
      setIsAuthenticated(response.authenticated || false);
      if (response.message) {
        setAuthStatus(response.message);
      }
    } catch (error) {
      console.error('Error checking auth status:', error);
      setIsAuthenticated(false);
    }
  };

  // Authenticate with YouTube
  const authenticateYouTube = async () => {
    setIsAuthenticating(true);
    setAuthStatus('Connecting to YouTube...');
    
    try {
      const response = await sendMessage('authenticate');
      setIsAuthenticating(false);
      
      if (response.success) {
        setIsAuthenticated(true);
        setAuthStatus('Successfully connected to YouTube!');
        setTimeout(() => setAuthStatus(''), 3000);
      } else {
        setIsAuthenticated(false);
        setAuthStatus(`Failed to connect: ${response.error}`);
        setTimeout(() => setAuthStatus(''), 5000);
      }
    } catch (error) {
      setIsAuthenticating(false);
      setAuthStatus('Authentication failed. Please try again.');
      setTimeout(() => setAuthStatus(''), 5000);
    }
  };

  // Create YouTube playlist from interests
  const createYouTubePlaylist = async () => {
    if (interests.length === 0) {
      setAuthStatus('Please add some interests first!');
      setTimeout(() => setAuthStatus(''), 3000);
      return;
    }

    setIsCreatingPlaylist(true);
    setAuthStatus('Creating your smart playlist...');
    setPlaylistResult(null);

    try {
      const response = await sendMessage('createPlaylist', {
        interests: interests,
        preferences: preferences
      });
      
      setIsCreatingPlaylist(false);
      
      if (response.success) {
        setPlaylistResult(response);
        setAuthStatus(`Smart playlist created! Added ${response.videosAdded} carefully selected videos.`);
      } else {
        setAuthStatus(`Failed to create playlist: ${response.error}`);
        // If auth expired, update auth status
        if (response.error.includes('authentication') || response.error.includes('expired')) {
          setIsAuthenticated(false);
        }
      }
      
      setTimeout(() => setAuthStatus(''), 5000);
    } catch (error) {
      setIsCreatingPlaylist(false);
      setAuthStatus('Failed to create playlist. Please try again.');
      setTimeout(() => setAuthStatus(''), 5000);
    }
  };

  // Disconnect from YouTube
  const disconnectYouTube = async () => {
    try {
      const response = await sendMessage('revokeAuth');
      if (response.success) {
        setIsAuthenticated(false);
        setPlaylistResult(null);
        setAuthStatus('Disconnected from YouTube');
        setTimeout(() => setAuthStatus(''), 3000);
      }
    } catch (error) {
      console.error('Error disconnecting:', error);
    }
  };

  const handleAdd = async () => {
    if (inputValue.trim()) {
      // Split by comma and clean up each interest
      const newInterests = inputValue
        .split(',')
        .map(interest => interest.trim())
        .filter(interest => interest.length > 0)
        .filter(interest => !interests.includes(interest)); // Avoid duplicates
        
      const updatedInterests = [...interests, ...newInterests];
      setInterests(updatedInterests);
      setInputValue('');
      
      // Save to Chrome storage
      await saveInterestsToStorage(updatedInterests);

      // Notify the content script to update the YouTube feed
      await notifyContentScript(updatedInterests);
    }
  };

  const handleCancel = () => {
    setInputValue('');
  };

  const handleDelete = async (interestToDelete) => {
    const updatedInterests = interests.filter(interest => interest !== interestToDelete);
    setInterests(updatedInterests);
    
    // Save to Chrome storage
    await saveInterestsToStorage(updatedInterests);

    // Notify the content script to update the YouTube feed
    await notifyContentScript(updatedInterests);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleAdd();
    }
  };

  const notifyContentScript = async (interests) => {
    try {
      const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
      console.log('Attempting to send message to tab:', tab.url);
      
      if(tab.url?.includes('youtube.com')) {
        chrome.tabs.sendMessage(tab.id, {
          action: 'updateInterests',
          interests: interests
        }, (response) => {
          if (chrome.runtime.lastError) {
            console.error('Extension message failed:', chrome.runtime.lastError.message);
          } else {
            console.log('Extension message sent successfully:', response);
          }
        });
      }
      console.log('Background script notified to update interests:', interests);
    } catch (error) {
      console.error('Error notifying background script:', error);
    }
  };

  const handleClearAll = async () => {
    const confirmed = window.confirm('Are you sure you want to clear all interests? This will reset your YouTube feed.');
    
    if (confirmed) {
      setInterests([]);
      // Save empty array to Chrome storage
      await saveInterestsToStorage([]);
      setPlaylistResult(null); // Clear playlist result too
    }
  };

  // Handle preference changes
  const handlePreferenceChange = (section, key, value) => {
    const newPreferences = { ...preferences };
    if (section) {
      newPreferences[section] = { ...newPreferences[section], [key]: value };
    } else {
      newPreferences[key] = value;
    }
    setPreferences(newPreferences);
  };

  const handleArrayPreferenceChange = (key, values) => {
    const newPreferences = { ...preferences, [key]: values };
    setPreferences(newPreferences);
  };

  if (isLoading) {
    return (
      <div className="w-80 p-4 bg-white">
        <div className="text-center text-gray-500">Loading interests...</div>
      </div>
    );
  }

  return (
    <div className="w-80 p-4 bg-white max-h-96 overflow-y-auto">
      <h2 className="text-lg font-semibold mb-4 text-gray-800">Your Interests</h2>
      
      {/* Input Section */}
      <div className="mb-4">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Enter interests (comma-separated)"
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
        />
        
        <div className="flex gap-2 mt-2">
          <button
            onClick={handleAdd}
            disabled={!inputValue.trim()}
            className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors text-sm"
          >
            Add
          </button>
          <button
            onClick={handleCancel}
            className="px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 transition-colors text-sm"
          >
            Cancel
          </button>
        </div>
      </div>

      {/* Interests List */}
      <div className="space-y-2 max-h-32 overflow-y-auto mb-4">
        {interests.length === 0 ? (
          <p className="text-gray-500 text-sm italic">No interests added yet</p>
        ) : (
          interests.map((interest, index) => (
            <div
              key={index}
              className="flex items-center justify-between bg-gray-100 px-3 py-2 rounded-md"
            >
              <span className="text-gray-800 text-sm">{interest}</span>
              <button
                onClick={() => handleDelete(interest)}
                className="text-red-500 hover:text-red-700 font-bold text-lg leading-none"
                title="Delete interest"
              >
                ×
              </button>
            </div>
          ))
        )}
      </div>

      {/* Interest Count */}
      {interests.length > 0 && (
        <div className="mb-4 flex items-center justify-between">
          <div className="text-sm text-gray-600">
            {interests.length} interest{interests.length !== 1 ? 's' : ''} added
          </div>
          <button
            onClick={handleClearAll}
            className="px-3 py-1 text-sm bg-red-500 text-white rounded-md hover:bg-red-600 transition-colors"
          >
            Clear All
          </button>
        </div>
      )}

      {/* YouTube Playlist Section */}
      <div className="pt-4 border-t border-gray-200">
        <h3 className="text-md font-semibold mb-3 text-gray-800 flex items-center">
          🎵 Smart YouTube Playlist
        </h3>
        
        {!isAuthenticated ? (
          <div className="space-y-2">
            <p className="text-sm text-gray-600">Connect to YouTube to create AI-curated playlists from your interests</p>
            <button
              onClick={authenticateYouTube}
              disabled={isAuthenticating}
              className="w-full px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center justify-center text-sm"
            >
              {isAuthenticating ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Connecting...
                </>
              ) : (
                '🔗 Connect to YouTube'
              )}
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-sm text-green-600 flex items-center">
              ✅ Connected to YouTube
            </p>
            <div className="flex gap-2">
              <button
                onClick={createYouTubePlaylist}
                disabled={isCreatingPlaylist || interests.length === 0}
                className="flex-1 px-3 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center justify-center text-sm"
              >
                {isCreatingPlaylist ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Creating...
                  </>
                ) : (
                  '🎶 Create Smart Playlist'
                )}
              </button>
              <button
                onClick={() => setShowPreferences(!showPreferences)}
                className="px-3 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors text-sm"
                title="Preferences"
              >
                ⚙️
              </button>
              <button
                onClick={disconnectYouTube}
                className="px-3 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 transition-colors text-sm"
                title="Disconnect"
              >
                🔌
              </button>
            </div>
          </div>
        )}

        {/* Preferences Panel */}
        {showPreferences && isAuthenticated && (
          <div className="mt-3 p-3 bg-gray-50 border border-gray-200 rounded-md">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-medium text-gray-800">Playlist Preferences</h4>
              <button
                onClick={() => setShowPreferences(false)}
                className="text-gray-500 hover:text-gray-700 text-sm"
              >
                ✕
              </button>
            </div>
            
            <div className="space-y-3 text-sm">
              {/* Video Duration Preference */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Preferred Video Length</label>
                <select
                  value={preferences.videoDuration.preferred}
                  onChange={(e) => handlePreferenceChange('videoDuration', 'preferred', e.target.value)}
                  className="w-full px-2 py-1 border border-gray-300 rounded text-xs"
                >
                  <option value="short">Short (0-4 min)</option>
                  <option value="medium">Medium (4-20 min)</option>
                  <option value="long">Long (20+ min)</option>
                </select>
              </div>

              {/* Content Type */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Content Type</label>
                <select
                  value={preferences.contentType}
                  onChange={(e) => handlePreferenceChange(null, 'contentType', e.target.value)}
                  className="w-full px-2 py-1 border border-gray-300 rounded text-xs"
                >
                  <option value="any">Any</option>
                  <option value="educational">Educational</option>
                  <option value="entertainment">Entertainment</option>
                  <option value="music">Music</option>
                  <option value="gaming">Gaming</option>
                </select>
              </div>

              {/* Language */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Language</label>
                <select
                  value={preferences.audioLanguage}
                  onChange={(e) => handlePreferenceChange(null, 'audioLanguage', e.target.value)}
                  className="w-full px-2 py-1 border border-gray-300 rounded text-xs"
                >
                  <option value="en">English</option>
                  <option value="es">Spanish</option>
                  <option value="fr">French</option>
                  <option value="de">German</option>
                  <option value="ja">Japanese</option>
                  <option value="ko">Korean</option>
                </select>
              </div>

              {/* Save Button */}
              <button
                onClick={() => saveUserPreferences(preferences)}
                className="w-full px-3 py-1 bg-blue-500 text-white rounded text-xs hover:bg-blue-600 transition-colors"
              >
                Save Preferences
              </button>
            </div>
          </div>
        )}

        {/* Status Message */}
        {authStatus && (
          <div className={`mt-2 p-2 rounded-md text-sm ${
            authStatus.includes('Success') || authStatus.includes('created') || authStatus.includes('saved')
              ? 'bg-green-100 text-green-700' 
              : authStatus.includes('Failed') || authStatus.includes('Error')
              ? 'bg-red-100 text-red-700'
              : 'bg-blue-100 text-blue-700'
          }`}>
            {authStatus}
          </div>
        )}

        {/* Playlist Result */}
        {playlistResult && (
          <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-md">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-green-800">
                Smart Playlist Created! 🎉
              </span>
              <button
                onClick={() => setPlaylistResult(null)}
                className="text-green-600 hover:text-green-800 text-sm"
              >
                ✕
              </button>
            </div>
            <div className="text-sm text-green-700 space-y-1">
              <div>📹 {playlistResult.videosAdded} videos added</div>
              <div>🎯 {playlistResult.totalInterests} interests covered</div>
              <div>🤖 AI-filtered for quality</div>
              <a 
                href={playlistResult.playlistUrl} 
                target="_blank" 
                rel="noopener noreferrer"
                className="inline-block mt-2 px-3 py-1 bg-green-500 text-white rounded text-sm hover:bg-green-600 transition-colors"
              >
                🔗 Open Playlist
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}





















// import { useState, useEffect } from 'react';

// export default function App() {
//   const [interests, setInterests] = useState([]);
//   const [inputValue, setInputValue] = useState('');
//   const [isLoading, setIsLoading] = useState(true);

//   // Load interests from Chrome storage on component mount
//   useEffect(() => {
//     loadInterestsFromStorage();
//   }, []);

//   // Load interests from storage
//   const loadInterestsFromStorage = async () => {
//     try {
//       const result = await chrome.storage.sync.get(['interests']);
//       const savedInterests = result.interests || [];
//       setInterests(savedInterests);
//       setIsLoading(false);
//     } catch (error) {
//       console.error('Error loading interests:', error);
//       setIsLoading(false);
//     }
//   };

//   // Save interests to Chrome storage
//   const saveInterestsToStorage = async (newInterests) => {
//     try {
//       await chrome.storage.sync.set({ interests: newInterests });
//       console.log('Interests saved to storage:', newInterests);
//     } catch (error) {
//       console.error('Error saving interests:', error);
//     }
//   };

//   const handleAdd = async () => {
//     if (inputValue.trim()) {
//       // Split by comma and clean up each interest
//       const newInterests = inputValue
//         .split(',')
//         .map(interest => interest.trim())
//         .filter(interest => interest.length > 0)
//         .filter(interest => !interests.includes(interest)); // Avoid duplicates
        
//       const updatedInterests = [...interests, ...newInterests];
//       setInterests(updatedInterests);
//       setInputValue('');
      
//       // Save to Chrome storage
//       await saveInterestsToStorage(interests);

//       //notify the bg script to update the YouTube feed
//       await notifyContentScript(interests);
//     }
//   };

//   const handleCancel = () => {
//     setInputValue('');
//   };

//   const handleDelete = async (interestToDelete) => {
//     const updatedInterests = interests.filter(interest => interest !== interestToDelete);
//     setInterests(updatedInterests);
    
//     // Save to Chrome storage
//     await saveInterestsToStorage(interests);

//     //notify the bg script to update the YouTube feed
//     await notifyContentScript(interests);
//   };

//   const handleKeyPress = (e) => {
//     if (e.key === 'Enter') {
//       handleAdd();
//     }
//   };
// const notifyContentScript = async (interests) => {
//   try {
//     const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
//     console.log('Attempting to send message to tab:', tab.url);
    
//     if(tab.url?.includes('youtube.com')) {
//       chrome.tabs.sendMessage(tab.id, {
//         action: 'updateInterests',
//         interests: interests
//       }, (response) => {
//         if (chrome.runtime.lastError) {
//           console.error('Extension message failed:', chrome.runtime.lastError.message);
//         } else {
//           console.log('Extension message sent successfully:', response);
//         }
//       });
//     }
//     console.log('Background script notified to update interests:', interests);
//   } catch (error) {
//     console.error('Error notifying background script:', error);
//   }
// }

//   const handleClearAll = async () => {
//     const confirmed = window.confirm('Are you sure you want to clear all interests? This will reset your YouTube feed.');
    
//     if (confirmed) {
//       setInterests([]);
//       // Save empty array to Chrome storage
//       await saveInterestsToStorage([]);
//     }
//   };

//   if (isLoading) {
//     return (
//       <div className="w-80 p-4 bg-white">
//         <div className="text-center text-gray-500">Loading interests...</div>
//       </div>
//     );
//   }

//   return (
//     <div className="w-80 p-4 bg-white">
//       <h2 className="text-lg font-semibold mb-4 text-gray-800">Your Interests</h2>
      
//       {/* Input Section */}
//       <div className="mb-4">
//         <input
//           type="text"
//           value={inputValue}
//           onChange={(e) => setInputValue(e.target.value)}
//           onKeyPress={handleKeyPress}
//           placeholder="Enter interests (comma-separated)"
//           className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
//         />
        
//         <div className="flex gap-2 mt-2">
//           <button
//             onClick={handleAdd}
//             disabled={!inputValue.trim()}
//             className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
//           >
//             Add
//           </button>
//           <button
//             onClick={handleCancel}
//             className="px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 transition-colors"
//           >
//             Cancel
//           </button>
//         </div>
//       </div>

//       {/* Interests List */}
//       <div className="space-y-2">
//         {interests.length === 0 ? (
//           <p className="text-gray-500 text-sm italic">No interests added yet</p>
//         ) : (
//           interests.map((interest, index) => (
//             <div
//               key={index}
//               className="flex items-center justify-between bg-gray-100 px-3 py-2 rounded-md"
//             >
//               <span className="text-gray-800">{interest}</span>
//               <button
//                 onClick={() => handleDelete(interest)}
//                 className="text-red-500 hover:text-red-700 font-bold text-lg leading-none"
//                 title="Delete interest"
//               >
//                 ×
//               </button>
//             </div>
//           ))
//         )}
//       </div>

//       {/* Interest Count */}
//       {interests.length > 0 && (
//         <div className="mt-4 flex items-center justify-between">
//           <div className="text-sm text-gray-600">
//             {interests.length} interest{interests.length !== 1 ? 's' : ''} added
//           </div>
//           <button
//             onClick={handleClearAll}
//             className="px-3 py-1 text-sm bg-red-500 text-white rounded-md hover:bg-red-600 transition-colors"
//           >
//             Clear All
//           </button>
//         </div>
//       )}
      
//       {/* Status Message */}
//       {/* <div className="mt-4 text-xs text-gray-500 text-center">
//         Changes are automatically saved and will update your YouTube feed.
//       </div> */}
//     </div>
//   );
// }