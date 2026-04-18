import { Song } from '../types';

const BASE_URL = typeof window !== 'undefined' ? `${window.location.origin}/api/music` : '/api/music';

export const searchSongs = async (query: string, page: number = 1): Promise<Song[]> => {
  try {
    const response = await fetch(`${BASE_URL}/search/songs?query=${encodeURIComponent(query)}&page=${page}`);
    if (!response.ok) throw new Error('Network response was not ok');
    const data = await response.json();
    
    if (data.status === "SUCCESS" && data.data && data.data.results) {
      return data.data.results;
    }
    return [];
  } catch (error) {
    console.error('Error searching songs:', error);
    return [];
  }
};

export const getTrendingSongs = async (): Promise<Song[]> => {
  try {
    const response = await fetch(`${BASE_URL}/modules`);
    if (!response.ok) throw new Error('Network response was not ok');
    const data = await response.json();
    
    if (data.status === "SUCCESS" && data.data && data.data.trending && data.data.trending.songs) {
      return data.data.trending.songs;
    }
    return [];
  } catch (error) {
    console.error('Error fetching trending songs:', error);
    return [];
  }
};

export const getCategorySongs = async (query: string, page: number = 1): Promise<Song[]> => {
  // Fetch real-time data directly
  return searchSongs(query, page);
};

export const getTopSongs = getTrendingSongs;

export const getSimilarSongs = async (song: Song): Promise<Song[]> => {
  try {
    // We can search by the primary artist to get similar songs
    let artistName = '';
    if (typeof song.primaryArtists === 'string') {
      artistName = song.primaryArtists.split(',')[0].trim();
    } else if (Array.isArray(song.primaryArtists) && song.primaryArtists.length > 0) {
      const firstArtist = song.primaryArtists[0];
      artistName = typeof firstArtist === 'string' ? firstArtist : (firstArtist.name || '');
    }
    
    if (!artistName) return [];
    
    const response = await fetch(`${BASE_URL}/search/songs?query=${encodeURIComponent(artistName)}`);
    if (!response.ok) throw new Error('Network response was not ok');
    const data = await response.json();
    
    if (data.status === "SUCCESS" && data.data && data.data.results) {
      // Filter out the current song
      return data.data.results.filter((s: Song) => s.id !== song.id);
    }
    return [];
  } catch (error) {
    console.error('Error fetching similar songs:', error);
    return [];
  }
};

export const getHighestQualityAudio = (downloadUrls: { quality: string; link: string }[] | { quality: string; url: string }[]): string => {
  if (!downloadUrls || downloadUrls.length === 0) return '';
  
  // Handle both 'link' and 'url' properties depending on the API version
  const getUrl = (item: any) => item?.link || item?.url;
  
  // Try to find 320kbps, then 160kbps, then fallback to the last one (usually highest if sorted)
  const quality320 = downloadUrls.find(d => d.quality === '320kbps');
  if (quality320 && getUrl(quality320)) return getUrl(quality320);
  
  const quality160 = downloadUrls.find(d => d.quality === '160kbps');
  if (quality160 && getUrl(quality160)) return getUrl(quality160);
  
  return getUrl(downloadUrls[downloadUrls.length - 1]) || '';
};

export const getHighestQualityImage = (images: { quality: string; link: string }[] | { quality: string; url: string }[]): string => {
  if (!images || images.length === 0) return 'https://picsum.photos/500/500';
  const getUrl = (item: any) => item?.link || item?.url;
  return getUrl(images[images.length - 1]) || 'https://picsum.photos/500/500';
};
