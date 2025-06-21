const complexObject = {
  value: 42,
  // This method should be commented by the tool
  
  // TODO: Document what getValuesSum does
  /**
   * getValuesSum
   * @param {any} a - Parameter 'a'
   * @param {any} b - Parameter 'b'
   * @returns {any} Return value
  getValuesSum(a, b) {
    return a + b + this.value;
  },
  // This arrow function method should also be commented
  
  // TODO: Document what init does
  /**
   * init
   * @param {any} config - Parameter 'config'
   * @returns {boolean} Return value
  init: (config) => {
    console.log("Initializing with config:", config);
    return true;
  },
  nested: {
    // This nested method should be commented
    
    // TODO: Document what process does
    /**
     * process
     * @param {any} data - Parameter 'data'
     * @returns {any} Return value
    process: (data) => {
      return data.id;
    },
  },
}; 