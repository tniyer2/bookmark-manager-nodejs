
const path = require("path");

const HtmlWebpackPlugin = require("html-webpack-plugin");
const MiniCssExtractPlugin = require("mini-css-extract-plugin");


const isProduction = process.env.NODE_ENV == "production";
const stylesHandler = MiniCssExtractPlugin.loader;


const OUTPUT_PATH = "./front_end/dist";
const HTML_TEMPLATE_PATH = "./front_end/html/index.html";

const resolvePath = (p) => path.resolve(__dirname, p);

const config = {
    entry: {
        popup: "./front_end/js/popup.js",
        gallery: "./front_end/js/gallery.js",
        singleView: "./front_end/js/singleView.js",
        settings: "./front_end/js/settings.js",
        icon: "./front_end/js/icons/icon.png"
    },
	optimization: {
		splitChunks: {
			cacheGroups: {
				commons: {
					name: "commons",
					chunks: "initial",
					minChunks: 2,
					minSize: 0
				}
			}
		},
		chunkIds: "deterministic"
	},
    output: {
        path: resolvePath(OUTPUT_PATH)
    },
    devServer: {
        open: true,
        host: "localhost"
    },
    plugins: [
        new HtmlWebpackPlugin({
            template: HTML_TEMPLATE_PATH,
            filename: "popup.html",
            chunks: ["popup"]
        }),
        new HtmlWebpackPlugin({
            template: HTML_TEMPLATE_PATH,
            filename: "gallery.html",
            chunks: ["gallery"]
        }),
        new HtmlWebpackPlugin({
            template: HTML_TEMPLATE_PATH,
            filename: "singleView.html",
            chunks: ["singleView"]
        }),
        new HtmlWebpackPlugin({
            template: HTML_TEMPLATE_PATH,
            filename: "settings.html",
            chunks: ["settings"]
        }),
        new MiniCssExtractPlugin()
    ],
    module: {
        rules: [
            {
                test: /\.(js|jsx)$/i,
                loader: "babel-loader"
            },
            {
                test: /\.s[ac]ss$/i,
                use: [stylesHandler, "css-loader", "postcss-loader", "sass-loader"]
            },
            {
                test: /\.css$/i,
                use: [stylesHandler, "css-loader", "postcss-loader"]
            },
            {
                test: /\.(eot|svg|ttf|woff|woff2|png|jpg|gif)$/i,
                type: "asset"
            },
            {
                test: /\.(png|jpe?g|gif)$/i,
                loader: "file-loader"
            }
        ]
    }
};

module.exports = () => {
    if (isProduction) {
        config.mode = "production";
    } else {
        config.mode = "development";
    }

    return config;
};
