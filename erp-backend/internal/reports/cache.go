package reports

import (
	"fmt"
	"sync"
	"time"
)

const reportCacheTTL = 5 * time.Minute

type reportCacheEntry struct {
	data     interface{}
	expiresAt time.Time
}

var reportCache = struct {
	mu    sync.RWMutex
	items map[string]reportCacheEntry
}{
	items: make(map[string]reportCacheEntry),
}

func reportCacheKey(tenantID, start, end string) string {
	return fmt.Sprintf("%s|%s|%s", tenantID, start, end)
}

func getCachedReport(key string) (interface{}, bool) {
	reportCache.mu.RLock()
	defer reportCache.mu.RUnlock()
	e, ok := reportCache.items[key]
	if !ok || time.Now().After(e.expiresAt) {
		return nil, false
	}
	return e.data, true
}

func setCachedReport(key string, data interface{}) {
	reportCache.mu.Lock()
	defer reportCache.mu.Unlock()
	reportCache.items[key] = reportCacheEntry{
		data:     data,
		expiresAt: time.Now().Add(reportCacheTTL),
	}
}
