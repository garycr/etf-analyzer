using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Data;
using System.Drawing;
using System.Linq;
using System.Text;
using System.Windows.Forms;
using System.Web;
using System.Net;
using System.IO;
using Strategic.DataServices.HtmlParser;
using Strategic.DataServices.Database;

namespace Strategic.DataServices.ClientTester
{
    public partial class Form1 : Form
    {
        public Form1()
        {
            InitializeComponent();
        }

        private void btnGo_Click(object sender, EventArgs e)
        {
            string gatewayUrl = @"http://finance.yahoo.com/q/hp?a=&b=&c=&d=10&e=28&f=2007&g=d&s=";

            // Request for 10/1/2007 to 10/28/2007 daily prices for XLU
            // "http://finance.yahoo.com/q/hp?s=XLU&a=10&b=1&c=2007&d=10&e=28&f=2007&g=d"


            HttpWebResponse response = null;

            try
            {
                gatewayUrl += this.txtSymbol.Text;

                HttpWebRequest request = (HttpWebRequest)WebRequest.Create(gatewayUrl);
                response = (HttpWebResponse)request.GetResponse();
                Stream stream = response.GetResponseStream();

                // Pass the stream to the document/parser and get a DOM back
                List<Price> result = Extractor.Extract(stream);
                stream.Close();

                StringBuilder sb = new StringBuilder();
                foreach (Price price in result)
                {
                    sb.Append(price.Date).Append("\t").Append(price.Open).Append("\t").Append(price.High).Append("\t").Append(price.Low).Append("\t").Append(price.Close).Append("\t").Append(price.Volume).Append("\t").Append(price.AdjustedClose).Append("\n");
                }
                
                this.rtfResults.Text = sb.ToString();

                // Write to the database
                ETFDb db = new ETFDb();
                db.InsertPrices(result, this.txtSymbol.Text);

            }
            catch (Exception ex)
            {
                StringBuilder sb = new StringBuilder();

                sb.Append(ex.ToString()).AppendLine().Append("\r\nThe request URI could not be found or was malformed");
                this.rtfResults.Text = sb.ToString();
            }
            finally
            {
                if (response != null)
                {
                    response.Close();
                }
            }
        }
    }
}
