import React, { Component } from 'react';
import ReactDOM from 'react-dom';
import './App.css';
import Measure from 'react-measure'
import { VariableSizeList as List } from 'react-window'
import raf from 'raf'
import {
  makeLog,
  makePlaceholder,
  debounce,
  throttle,
  getTextWidth,
  makeString,
  getScrollDirection,
} from './utils'
import ReportSize from './ReportSize'

const LOAD_THRESHOLD = 200
const BATCH_SIZE = 300
const RESPONSE_TIME = 500

const fetchLogs = (
  count = BATCH_SIZE,
  timeout = RESPONSE_TIME
) => {
  return new Promise(resolve => {
    setTimeout(() => {
      const logs = new Array(count).fill().map(makeLog)
      resolve(logs)
    }, timeout)
  })
}

const makePlaceholders = (count = BATCH_SIZE) => {
  return new Array(count).fill().map(makePlaceholder)
}

class App extends Component {
  constructor(props) {
    super(props)

    const logs = new Array(500).fill().map(makeLog)
    const placeholders = new Array(50).fill().map(makePlaceholder)

    this.state = {
      logs,
      height: window.innerHeight,
      width: window.innerWidth,
      containerHeight: window.innerHeight,
      containerWidth: window.innerWidth,
      heightCache: null,
      isLoadingOlderRows: false,
      isLoadingNewerRows: false,
      isTailing: false,
    }

    this.getItemSize = this.getItemSize.bind(this)
    this.renderRow = this.renderRow.bind(this)
    this.updateCacheAndMeasurements = this.updateCacheAndMeasurements.bind(this)
    this.handleResize = debounce(this.handleResize, 100, false)
    this.onItemsRendered = this.onItemsRendered.bind(this)
  }

  componentDidMount () {
    this.setState({
      calculatingCacheSizes: true,
    }, () => {
      this.cacheLogHeights()
        .then(this.updateCacheAndMeasurements)
        .then(() => {
          this.scrollToIndex(this.state.logs.length - 1)
        })
    })
  }

  startTail = () => {
    this.setState({ isTailing: true }, () => {
      this.tailId = setInterval(() => {
        if (this.state.isTailing) {
          this.loadNewerRows().then(logs => {
            this.scrollToIndex(logs.length - 1)
          })
        }
      }, 2000)
      console.log('start:', this.tailId)
    })
  }

  stopTail = () => {
    console.log('stop', this.tailId)
    clearInterval(this.tailId)
    this.setState({ isTailing: false })
  }

  handleResize = ({ bounds }) => {
    this.setState({
      containerHeight: bounds.height,
      containerWidth: bounds.width,
      calculatingCacheSizes: true,
    }, () => {
      this.cacheLogHeights()
        .then(this.updateCacheAndMeasurements)
    })
  }

  updateCacheAndMeasurements (data) {
    // Update measurements and set cache loading state
    return new Promise(resolve => {
      this.setState({
        ...data,
        calculatingCacheSizes: false
      }, () => {
        // Force List to clear cached heights
        if (this.List) {
          this.List.resetAfterIndex(0)
        }
        resolve()
      })
    })
  }

  onScroll = ({
    scrollOffset,
    scrollDirection,
    scrollUpdateWasRequested
  }) => {
    raf(() => {
      // For some reason the react-window direction is not always accurate
      // specifically right after we've forcefully scrolled to an index
      // this.scrollDirection = getScrollDirection(scrollOffset, this.mostRecentScrollOffset)
      this.scrollDirection = scrollUpdateWasRequested ? null : scrollDirection
      this.isScrolling = scrollOffset !== this.mostRecentScrollOffset
      this.mostRecentScrollOffset = scrollOffset

      const { isTailing } = this.state

      if (this.isScrolledToBottom && !isTailing) {
        return this.startTail()
      }

      if (!this.isScrolledToBottom && isTailing) {
        return this.stopTail()
      }
    })
    // if (scrollDirection === 'backward' && scrollOffset === 0) {
    //   console.log('added 300 to top, length is now', this.state.logs.length)
    //   this.setState({
    //     logs: makePlaceholders(300).concat(this.state.logs)
    //   }, () => {
    //     // See https://github.com/bvaughn/react-window/blob/f76d121269a559e4bf5d9c38896c5ac25f8235ae/src/VariableSizeList.js#L263
    //     this.List.resetAfterIndex(0)
    //     this.List.scrollToItem(300)
    //   })
    // }
  }

  isRowLoaded ({ index }) {
    return this.state.logs[index].isPlaceholder
  }

  loadOlderRows = () => {
    fetchLogs().then(resp => {
      this.setState({
        logs: resp.concat(this.state.logs),
        isLoadingOlderRows: false,
      }, () => {
        console.log(
          'loaded 300 older rows',
          `scrolling to ${this.visibleStartIndex + resp.length}`
        )
        this.List.resetAfterIndex(0)
        this.scrollToIndex(this.visibleStartIndex + resp.length, 'start')
      })
    })
  }

  loadNewerRows = () => {
    return new Promise(resolve => {
      fetchLogs().then(resp => {
        const newLogs = this.state.logs.concat(resp)
        this.setState({
          logs: newLogs,
          isLoadingNewerRows: false,
        }, () => {
          console.log('loaded 300 new rows')
          resolve(newLogs)
        })
      })
    })
  }

  onItemsRendered = ({
    visibleStartIndex,
    visibleStopIndex
  }) => {
    this.visibleStartIndex = visibleStartIndex
    this.visibleStopIndex = visibleStopIndex
    this.isScrolledToBottom = visibleStopIndex === this.state.logs.length - 1

    if (!this.isScrolling) return false

    const shouldLoadOlderRows = (
      this.scrollDirection === 'backward' &&
      this.isScrolling &&
      !this.state.isLoadingOlderRows &&
      visibleStartIndex < LOAD_THRESHOLD
    )

    if (shouldLoadOlderRows) {
      return this.setState({
        isLoadingOlderRows: true
      }, this.loadOlderRows)
    }

    const shouldLoadNewerRows = (
      this.scrollDirection === 'forward' &&
      this.isScrolling &&
      !this.state.isLoadingNewerRows &&
      visibleStopIndex > this.state.logs.length - LOAD_THRESHOLD
    )

    if (shouldLoadNewerRows) {
      return this.setState({
        isLoadingNewerRows: true
      }, () => {
        this.loadNewerRows()
          .then(() => {
            this.scrollToIndex(visibleStopIndex, 'end')
          })
      })
    }
  }

  cacheLogHeights () {
    return new Promise(resolve => {
      document.getElementById('cache').style.display = 'initial'
      // Get character width and characters per line
      // since the font is set to monospace this works with any character
      const charWidth = getTextWidth('x', '13px monospace')
      const charsPerLine = Math.floor(this.state.containerWidth / charWidth)
      const heightCache = {}

      // Generate some test strings based on the different message lengths
      // eslint-disable-next-line
      const testStrings = new Array(20).fill().map((_, i) => {
        return makeString((i + 1) * charsPerLine)
      })

      // Map all the test strings to react components that report sizes
      const Elements = () => testStrings.map(
        t => (
          <ReportSize
            key={t}
            message={t}
            getSize={size => heightCache[t.length] = size.height}
          />
        )
      )

      // Render the test elements and record their sizes in the height cache
      ReactDOM.render(
        <Elements />,
        document.getElementById('cache'),
        () => {
          document.getElementById('cache').style.display = 'none'
          resolve({
            charWidth,
            charsPerLine,
            heightCache,
            lineHeight: heightCache[Object.keys(heightCache)[0]],
          })
        }
      )
    })
  }

  getItemSize (idx) {
    const { logs, heightCache, lineHeight } = this.state
    const log = logs[idx]
    const cache = heightCache
    const length = log.message.length

    // If it's a placeholder
    if (log.isPlaceholder) {
      return lineHeight
    }

    // Find the closest cached height to this log's length
    let prev = lineHeight
    for (let h in cache) {
      if (length < h) {
        return cache[h]
      } else if (length > prev && length < h) {
        return cache[h]
      } else {
        prev = cache[h]
      }
    }
  }

  scrollToIndex = (idx, position = 'start') => {
    this.isScrolling = false
    this.scrollDirection = null
    this.mostRecentScrollOffset = null
    this.List.scrollToItem(idx, position)
  }

  renderRow ({ index, style }) {
    const item = this.state.logs[index]

    if (item.isPlaceholder) {
      return (
        <div style={style}>
          Placeholder
        </div>
      )
    }

    return (
      <div style={style}>
        {item.message}
      </div>
    )
  }

  render() {
    const {
      logs,
      containerHeight,
      containerWidth,
      charWidth,
      charsPerLine,
      lineHeight,
      calculatingCacheSizes,
      heightCache,
      isLoadingOlderRows,
      isLoadingNewerRows,
      isTailing,
    } = this.state

    const isLoading = !heightCache || calculatingCacheSizes

    return (
      <div className='App'>
        <ul className='stats'>
          <li>rows: <mark>{this.state.logs.length}</mark></li>
          <li>height: <mark>{containerHeight}</mark></li>
          <li>width: <mark>{containerWidth}</mark></li>
          <li>char: <mark>{Math.round(charWidth * 100) / 100}px</mark></li>
          <li>chars/line: <mark>{charsPerLine}</mark></li>
          <li>line: <mark>{lineHeight}px</mark></li>
          <li>caching: <mark>{calculatingCacheSizes ? 'true' : 'false'}</mark></li>
          <li>loading older: <mark>{isLoadingOlderRows ? 'true' : 'false'}</mark></li>
          <li>loading newer: <mark>{isLoadingNewerRows ? 'true' : 'false'}</mark></li>
          <li>tailing: <mark>{isTailing ? 'true' : 'false'}</mark></li>
        </ul>
        <div className='console'>
          <div className='console-wrapper'>
            <Measure bounds onResize={this.handleResize}>
              {({ measureRef }) => (
                <div
                  ref={measureRef}
                  style={{ height: '100%', width: '100%' }}
                  id="console-logs"
                >
                  {
                    !isLoading &&
                    <List
                      itemCount={logs.length}
                      height={containerHeight}
                      width={containerWidth}
                      itemSize={this.getItemSize}
                      ref={r => this.List = r}
                      onScroll={this.onScroll}
                      overscanCount={5}
                      onItemsRendered={this.onItemsRendered}
                    >
                      {this.renderRow}
                    </List>
                  }
                  <div id="cache" style={{ visibility: 'hidden' }} />
                </div>
              )}
            </Measure>
          </div>
        </div>
        <div className='footer'>
          <button onClick={() => {
            this.scrollToIndex(logs.length - 1)
            this.startTail()
          }}>
            Scroll to Bottom
          </button>
          <form onSubmit={e => {
            e.preventDefault()
            this.scrollToIndex(e.target[0].value)
          }}>
            <input
              type="text"
              name="index"
              placeholder="scroll to index"
              width={50}
            />
          </form>
        </div>
      </div>
    );
  }
}

export default App;
