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
      rowRendered: 0,
      scrollToIndex: 49,
      scrollToPosition: 'bottom',
      heightCache: null,
    };

    this.renderLog = this.renderLog.bind(this);
    this.getItemSize = this.getItemSize.bind(this);
    this.handleResize = debounce(this.handleResize, 100, false)
  }

  componentDidMount() {
    this.setState({
      calculatingCacheSizes: true,
    }, () => {
      this.cacheLogHeights()
        .then(data => this.setState({
          ...data,
          calculatingCacheSizes: false
        }))
    })
  }

  handleResize = ({ bounds }) => {
    this.setState({
      containerHeight: bounds.height,
      containerWidth: bounds.width,
      calculatingCacheSizes: true,
    }, () => {
      this.cacheLogHeights()
        .then(data => this.setState({
          ...data,
          calculatingCacheSizes: false
        }))
    })
  }

  renderLog(index, key) {
    const log = this.state.logs[index];
    const heroku = log.context.platform.heroku;
    const str = `${log.dt} ${heroku.source}:[${heroku.dyno_type}.${heroku.dyno_id}]`;
    return (
      <div className='Log' key={key}>
        <span>index: {index} id: {log.id}</span> <span>{str}:</span> {log.message}
      </div>
    );
  }

  cacheLogHeights () {
    return new Promise((resolve, reject) => {
      document.getElementById('cache').style.display = 'initial'
      // Get character width and characters per line
      const charWidth = getTextWidth(' ', '13px monospace')
      const charsPerLine = Math.floor(this.state.containerWidth / charWidth)
      const heightCache = {}

      // Generate some test strings based on the different message lengths
      const testStrings = new Array(20).fill().map((a, i) => {
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
          // document.getElementById('cache').style.display = 'none'
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
    console.log('isLoading', isLoading)
    console.log(this.state)

    return (
      <div className='App'>
        <ul className='stats'>
          <li>count: {this.state.logs.length}</li>
          <li>rendered: {this.state.rowRendered}</li>
          <li>height: {containerHeight}</li>
          <li>width: {containerWidth}</li>
          <li>character width: {charWidth}</li>
          <li>characters per line: {charsPerLine}</li>
          <li>calculating cache: {calculatingCacheSizes ? 'true' : 'false'}</li>
        </ul>
        <div className='console' style={{ fontSize: 13, fontFamily: 'monospace', height: '100%', width: '100%' }}>
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
        <div className='footer'>
          Footer
        </div>
      </div>
    );
  }
}

export default App;
