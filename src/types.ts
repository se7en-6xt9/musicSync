export interface SongImage {
  quality: string;
  url: string;
}

export interface SongDownloadUrl {
  quality: string;
  url: string;
}

export interface Artist {
  id: string;
  name: string;
  role: string;
  type: string;
  image: SongImage[];
  url: string;
}

export interface Song {
  id: string;
  name: string;
  type: string;
  album: {
    id: string;
    name: string;
    url: string;
  };
  year: string;
  releaseDate: string;
  duration: number;
  label: string;
  primaryArtists: string | Artist[];
  primaryArtistsId: string;
  featuredArtists: string | Artist[];
  featuredArtistsId: string;
  explicitContent: number;
  playCount: number;
  language: string;
  hasLyrics: string;
  url: string;
  copyright: string;
  image: SongImage[];
  downloadUrl: SongDownloadUrl[];
  lyricsId?: string;
}

export interface RoomMember {
  id: string;
  name: string;
  isOnline: boolean;
  isAdmin: boolean;
}

export interface ChatMessage {
  id: string;
  userId: string;
  userName: string;
  text: string;
  timestamp: number;
}

export interface Room {
  id: string;
  name: string;
  code: string;
  members: RoomMember[];
  messages?: ChatMessage[];
  playbackState?: {
    currentSong: Song | null;
    isPlaying: boolean;
    queue: Song[];
    currentTime: number;
    updatedAt: number;
  };
}
