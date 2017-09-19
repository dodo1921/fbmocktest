'use strict';

module.exports = {
  
  production: {
    client: 'mysql',
    connection: process.env.JAWSDB_URL    
  }

};

