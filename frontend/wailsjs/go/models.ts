export namespace downloader {
	
	export class DependencyStatus {
	    ytDlpInstalled: boolean;
	    ytDlpVersion: string;
	    ffmpegInstalled: boolean;
	    ffmpegVersion: string;
	
	    static createFrom(source: any = {}) {
	        return new DependencyStatus(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.ytDlpInstalled = source["ytDlpInstalled"];
	        this.ytDlpVersion = source["ytDlpVersion"];
	        this.ffmpegInstalled = source["ffmpegInstalled"];
	        this.ffmpegVersion = source["ffmpegVersion"];
	    }
	}
	export class DownloadOptions {
	    url: string;
	    title: string;
	    saveDir: string;
	    quality: string;
	    formatType: string;
	    audioFormat: string;
	    embedSubs: boolean;
	    embedThumbnail: boolean;
	    embedMetadata: boolean;
	    customFilename: string;
	    downloadPlaylist: boolean;
	
	    static createFrom(source: any = {}) {
	        return new DownloadOptions(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.url = source["url"];
	        this.title = source["title"];
	        this.saveDir = source["saveDir"];
	        this.quality = source["quality"];
	        this.formatType = source["formatType"];
	        this.audioFormat = source["audioFormat"];
	        this.embedSubs = source["embedSubs"];
	        this.embedThumbnail = source["embedThumbnail"];
	        this.embedMetadata = source["embedMetadata"];
	        this.customFilename = source["customFilename"];
	        this.downloadPlaylist = source["downloadPlaylist"];
	    }
	}
	export class DownloadTask {
	    id: string;
	    url: string;
	    title: string;
	    uploader: string;
	    thumbnail: string;
	    durationStr: string;
	    saveDir: string;
	    outputFile: string;
	    quality: string;
	    formatType: string;
	    audioFormat: string;
	    status: string;
	    progress: number;
	    speed: string;
	    eta: string;
	    downloadedBytes: string;
	    totalBytes: string;
	    log: string;
	    error?: string;
	    // Go type: time
	    createdAt: any;
	    // Go type: time
	    finishedAt?: any;
	
	    static createFrom(source: any = {}) {
	        return new DownloadTask(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.url = source["url"];
	        this.title = source["title"];
	        this.uploader = source["uploader"];
	        this.thumbnail = source["thumbnail"];
	        this.durationStr = source["durationStr"];
	        this.saveDir = source["saveDir"];
	        this.outputFile = source["outputFile"];
	        this.quality = source["quality"];
	        this.formatType = source["formatType"];
	        this.audioFormat = source["audioFormat"];
	        this.status = source["status"];
	        this.progress = source["progress"];
	        this.speed = source["speed"];
	        this.eta = source["eta"];
	        this.downloadedBytes = source["downloadedBytes"];
	        this.totalBytes = source["totalBytes"];
	        this.log = source["log"];
	        this.error = source["error"];
	        this.createdAt = this.convertValues(source["createdAt"], null);
	        this.finishedAt = this.convertValues(source["finishedAt"], null);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class MediaInfo {
	    url: string;
	    title: string;
	    uploader: string;
	    duration: number;
	    durationStr: string;
	    thumbnail: string;
	    description: string;
	    isPlaylist: boolean;
	    playlistCount: number;
	    availableResolutions: string[];
	
	    static createFrom(source: any = {}) {
	        return new MediaInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.url = source["url"];
	        this.title = source["title"];
	        this.uploader = source["uploader"];
	        this.duration = source["duration"];
	        this.durationStr = source["durationStr"];
	        this.thumbnail = source["thumbnail"];
	        this.description = source["description"];
	        this.isPlaylist = source["isPlaylist"];
	        this.playlistCount = source["playlistCount"];
	        this.availableResolutions = source["availableResolutions"];
	    }
	}

}

