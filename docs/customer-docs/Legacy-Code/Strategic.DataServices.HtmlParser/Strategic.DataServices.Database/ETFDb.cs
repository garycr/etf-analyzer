using System;
using System.Collections.Generic;
using System.Linq;
using System.Data.Linq;
using System.Text;
using System.Configuration;

namespace Strategic.DataServices.Database
{
    public class ETFDb
    {

        public void InsertPrices(List<Price> myPrices, string symbol)
        {
            //System.Configuration.ConfigurationSettings.AppSettings.
            //ConnectionStringSettingsCollection connections = ConfigurationManager.ConnectionStrings;

            
            ETFDataContext ctx = new ETFDataContext();

            try
            {
                foreach (Price p in myPrices)
                {
                    p.Symbol = symbol;
                    ctx.Prices.InsertOnSubmit(p);
                }

                ctx.SubmitChanges();
            }
            finally
            {
                ctx.Connection.Close();
            }
        }
    }
}
