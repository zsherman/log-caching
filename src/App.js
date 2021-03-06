import React, { Component } from 'react';
import ReactDOM from 'react-dom';
import './App.css';
import Measure from 'react-measure'
import { VariableSizeList as List } from 'react-window';
import { makeLog, debounce, getTextWidth, makeString } from './utils'
import ReportSize from './ReportSize'

class App extends Component {
  constructor(props) {
    super(props);

    this.state = {
      logs: new Array(1000).fill().map(makeLog),
      height: window.innerHeight,
      width: window.innerWidth,
      containerHeight: window.innerHeight,
      containerWidth: window.innerWidth,
      heightCache: null,
    };

    this.getItemSize = this.getItemSize.bind(this);
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
    const length = logs[idx].message.length

    // Find the closest cached height to this log's length
    let prev = heightCache[0]
    for (let h in heightCache) {
      if (length < h) {
        return heightCache[h]
      } else if (length > prev && length < h) {
        return heightCache[h]
      } else {
        prev = heightCache[h]
      }
    }
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
          <li>row count: <mark>{this.state.logs.length}</mark></li>
          <li>height: <mark>{containerHeight}</mark></li>
          <li>width: <mark>{containerWidth}</mark></li>
          <li>character width: <mark>{charWidth}</mark></li>
          <li>characters per line: <mark>{charsPerLine}</mark></li>
          <li>calculating cache: <mark>{calculatingCacheSizes ? 'true' : 'false'}</mark></li>
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
                    >
                      {({ index, style }) => (
                        <div style={style}>
                          {logs[index].message}
                        </div>
                      )}
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
        </div>
      </div>
    );
  }
}

export default App;
