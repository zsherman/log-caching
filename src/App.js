import React, { Component } from 'react';
import ReactDOM from 'react-dom';
import './App.css';
import Measure from 'react-measure'
import { VariableSizeList as List } from 'react-window';
import { makeLog, makePlaceholder, debounce, getTextWidth, makeString } from './utils'
import ReportSize from './ReportSize'

const fetchLogs = (count = 300, timeout = 500) => {
  return new Promise(resolve => {
    setTimeout(() => {
      const logs = new Array(count).fill().map(makeLog)
      resolve(logs)
    }, timeout)
  })
}

const makePlaceholders = (count = 300) => {
  return new Array(count).fill().map(makePlaceholder)
}

class App extends Component {
  constructor(props) {
    super(props);

    const logs = new Array(500).fill().map(makeLog)
    const placeholders = new Array(50).fill().map(makePlaceholder)

    this.state = {
      logs: placeholders.concat(logs),
      height: window.innerHeight,
      width: window.innerWidth,
      containerHeight: window.innerHeight,
      containerWidth: window.innerWidth,
      heightCache: null,
    };

    this.getItemSize = this.getItemSize.bind(this);
    this.renderRow = this.renderRow.bind(this)
    this.updateCacheAndMeasurements = this.updateCacheAndMeasurements.bind(this);
    this.handleResize = debounce(this.handleResize, 100, false)
  }

  componentDidMount() {
    this.setState({
      calculatingCacheSizes: true,
    }, () => {
      this.cacheLogHeights()
        .then(this.updateCacheAndMeasurements)
    })
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
    this.setState({
      ...data,
      calculatingCacheSizes: false
    })

    // Force List to clear cached heights
    if (this.List) {
      this.List.resetAfterIndex(0)
    }
  }

  onScroll = ({ scrollDirection, scrollOffset }) => {
    // console.log(scrollDirection)
    // this.scrollDirection = scrollDirection
    if (scrollDirection === 'backward' && scrollOffset === 0) {
      console.log('added 300 to top, length is now', this.state.logs.length)
      this.setState({
        logs: makePlaceholders(300).concat(this.state.logs)
      }, () => {
        console.log('scrolling to 300')
        this.List.resetAfterIndex(0)
        this.List.scrollToItem(300)
      })
    }
  }

  isRowLoaded ({ index }) {
    return
  }

  // onItemsRendered = ({
  //   overscanStartIndex,
  //   overscanStopIndex,
  //   visibleStartIndex,
  //   visibleStopIndex
  // }) => {
  //   if (visibleStartIndex === 0 && this.scrollDirection === 'backward') {
  //     this.setState({
  //       logs: makePlaceholders(300).concat(this.state.logs)
  //     }, () => {
  //       console.log('added 300 to top, length is now', this.state.logs.length)
  //       this.List.scrollToItem(300)
  //     })
  //   }
  // }

  cacheLogHeights () {
    return new Promise(resolve => {
      document.getElementById('cache').style.display = 'initial'
      // Get character width and characters per line
      const charWidth = getTextWidth(' ', '13px monospace')
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
          })
        }
      )
    })
  }

  getItemSize (idx) {
    const { logs, heightCache } = this.state
    const log = logs[idx]
    const cache = heightCache

    // If it's a placeholder
    if (log.isPlaceholder) {
      return cache[Object.keys(cache)[0]]
    }

    const length = log.message.length

    // Find the closest cached height to this log's length
    let prev = cache[Object.keys(cache)[0]]
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

  scrollToBottom = () => {
    this.List.scrollToItem(this.state.logs.length - 1)
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
      calculatingCacheSizes,
      heightCache,
    } = this.state

    const isLoading = !heightCache || calculatingCacheSizes

    return (
      <div className='App'>
        <ul className='stats'>
          <li>count: <mark>{this.state.logs.length}</mark></li>
          <li>height: <mark>{containerHeight}</mark></li>
          <li>width: <mark>{containerWidth}</mark></li>
          <li>char width: <mark>{charWidth}</mark></li>
          <li>chars per line: <mark>{charsPerLine}</mark></li>
          <li>caching heights: <mark>{calculatingCacheSizes ? 'true' : 'false'}</mark></li>
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
                      // onItemsRendered={this.onItemsRendered}
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
          Footer
          <button onClick={this.scrollToBottom}>
            Scroll to Bottom
          </button>
        </div>
      </div>
    );
  }
}

export default App;
